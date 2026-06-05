/**
 * Opt-in WRITE probe: validate Coolify's env create/update/delete endpoints against
 * a live instance using rumi's own client methods. Unlike the other probes this
 * MUTATES your instance, so it is off unless you ask for it twice:
 *
 *   RUMI_WRITE_PROBE=1 bun run scripts/probe-env-write.ts [KEY]
 *
 * It only ever touches a single throwaway key (default RUMI_PROBE_TMP) on the first
 * app/service, and refuses to run if that key already exists — so it can't clobber
 * a real var. It never prints values. It creates the key, updates it, then deletes
 * it, reporting each step. If create succeeds but a later step fails, the key may be
 * left behind — delete it from the Coolify UI.
 */
import { defaultContext, loadContexts } from "../src/config.ts";
import { CoolifyClient } from "../src/coolify/client.ts";
import { envCreatePayload, envUpdatePayload } from "../src/coolify/types.ts";

if (process.env.RUMI_WRITE_PROBE !== "1") {
  console.log("This probe writes to your live Coolify instance. Re-run with RUMI_WRITE_PROBE=1 to confirm:");
  console.log("  RUMI_WRITE_PROBE=1 bun run scripts/probe-env-write.ts [KEY]");
  process.exit(0);
}

const ctx = defaultContext(loadContexts());
if (!ctx) {
  console.error("No Coolify context configured.");
  process.exit(1);
}

const key = process.argv[2] ?? "RUMI_PROBE_TMP";
const client = new CoolifyClient(ctx);

try {
  const resources = await client.listResources();
  const target = resources.find((r) => r.kind === "application" || r.kind === "service");
  if (!target) {
    console.error("No application or service to probe against.");
    process.exit(1);
  }

  const existing = await client.getEnvVars(target);
  if (existing.some((e) => e.key === key)) {
    console.error(`"${key}" already exists on ${target.name}. Pick a throwaway key that doesn't, e.g.:`);
    console.error("  RUMI_WRITE_PROBE=1 bun run scripts/probe-env-write.ts RUMI_PROBE_TMP_2");
    process.exit(1);
  }

  console.log(`target: ${target.name} (${target.kind})   probe key: ${key}\n`);

  const rowsForKey = async () => (await client.getEnvVars(target)).filter((e) => e.key === key);

  await client.createEnvVar(target, envCreatePayload(key, "rumi-probe-create"));
  const created = await rowsForKey();
  console.log(
    created.length ? `✓ create  (POST /envs -> ${created.length} row(s))` : "✗ create  (key absent after POST)",
  );
  // An app with preview deployments gets a production + a preview row per key —
  // expected, not a duplicate. The production (is_preview=false) row is the one
  // an edit targets.
  const prod = created.find((e) => !e.preview) ?? created[0];
  if (created.length > 1)
    console.log(`  (apps split each key into production + preview — ${created.length} rows here)`);

  if (prod) {
    await client.updateEnvVar(target, envUpdatePayload(prod, "rumi-probe-update"));
    const changed = (await rowsForKey()).some((e) => !e.preview && e.value === "rumi-probe-update");
    console.log(
      changed ? "✓ update  (PATCH /envs changed the production value)" : "✗ update  (value unchanged after PATCH)",
    );
  }

  // Delete every row for the key (covers the preview row too) so nothing is left.
  for (const e of await rowsForKey()) await client.deleteEnvVar(target, e.uuid);
  const gone = (await rowsForKey()).length === 0;
  console.log(gone ? "✓ delete  (DELETE /envs/{uuid}, all rows gone)" : "✗ delete  (rows still present)");

  console.log("\nDone. If every line is ✓, rumi's env writes match this instance.");
} catch (err) {
  console.error(`\n✗ probe failed: ${(err as Error).message}`);
  console.error(`If the "${key}" var was created before the failure, remove it from the Coolify UI.`);
  process.exit(1);
}
