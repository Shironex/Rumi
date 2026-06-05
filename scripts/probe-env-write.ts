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

  await client.createEnvVar(target, envCreatePayload(key, "rumi-probe-create"));
  const created = (await client.getEnvVars(target)).find((e) => e.key === key);
  console.log(created ? "✓ create  (POST /envs, key present after)" : "✗ create  (POST returned but key absent)");

  if (created) {
    await client.updateEnvVar(target, envUpdatePayload(created, "rumi-probe-update"));
    console.log("✓ update  (PATCH /envs accepted)");

    const toDelete = (await client.getEnvVars(target)).find((e) => e.key === key);
    if (toDelete) {
      await client.deleteEnvVar(target, toDelete.uuid);
      const gone = !(await client.getEnvVars(target)).some((e) => e.key === key);
      console.log(gone ? "✓ delete  (DELETE /envs/{uuid}, key gone after)" : "✗ delete  (key still present)");
    }
  }

  console.log("\nDone. If every line is ✓, rumi's env writes match this instance.");
} catch (err) {
  console.error(`\n✗ probe failed: ${(err as Error).message}`);
  console.error(`If the "${key}" var was created before the failure, remove it from the Coolify UI.`);
  process.exit(1);
}
