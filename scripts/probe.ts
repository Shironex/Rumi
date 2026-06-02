/**
 * Throwaway probe: check each configured Coolify instance — which token works,
 * and the real shape of /api/v1/resources. Never prints the token.
 * Run: bun run scripts/probe.ts
 */
import { loadContexts } from "../src/config.ts";

async function hit(fqdn: string, token: string, path: string) {
  try {
    const res = await fetch(`${fqdn}${path}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });
    const text = await res.text();
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      return { status: res.status, note: `non-JSON: ${text.slice(0, 120)}` };
    }
    return { status: res.status, json };
  } catch (err) {
    return { status: 0, note: `fetch failed: ${(err as Error).message}` };
  }
}

for (const ctx of loadContexts()) {
  console.log(`\n=== ${ctx.name} (${ctx.fqdn})${ctx.default ? " [default]" : ""} ===`);

  const version = await hit(ctx.fqdn, ctx.token, "/api/v1/version");
  console.log(`  /version  -> ${version.status}`, version.note ?? JSON.stringify(version.json));

  const resources = await hit(ctx.fqdn, ctx.token, "/api/v1/resources");
  if (Array.isArray(resources.json)) {
    const arr = resources.json as Array<Record<string, unknown>>;
    console.log(`  /resources-> ${resources.status} array[${arr.length}]`);
    if (arr[0]) console.log("    keys:", Object.keys(arr[0]).sort().join(", "));
    for (const item of arr.slice(0, 10)) {
      console.log(`    - ${String(item.name)} | ${String(item.type)} | ${String(item.status)}`);
    }
  } else {
    console.log(`  /resources-> ${resources.status}`, resources.note ?? JSON.stringify(resources.json));
  }
}
