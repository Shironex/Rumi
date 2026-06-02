/**
 * Throwaway probe: discover the shape of GET /api/v1/servers (read-only, safe).
 * Never prints the token. Run: bun run scripts/probe-servers.ts
 */
import { defaultContext, loadContexts } from "../src/config.ts";

const ctx = defaultContext(loadContexts());
if (!ctx) {
  console.error("no context");
  process.exit(1);
}
const headers = { Authorization: `Bearer ${ctx.token}`, Accept: "application/json" };

const res = await fetch(`${ctx.fqdn}/api/v1/servers`, { headers });
const text = await res.text();
console.log(`/api/v1/servers -> ${res.status}`);

let json: unknown;
try {
  json = JSON.parse(text);
} catch {
  console.log(`  non-JSON: ${text.slice(0, 200)}`);
  process.exit(0);
}

if (Array.isArray(json)) {
  const arr = json as Array<Record<string, unknown>>;
  console.log(`  array[${arr.length}]`);
  if (arr[0]) {
    console.log("  top-level keys:", Object.keys(arr[0]).sort().join(", "));
    const settings = arr[0].settings;
    if (settings && typeof settings === "object") {
      console.log(
        "  settings keys:",
        Object.keys(settings as object)
          .sort()
          .join(", "),
      );
    }
  }
  for (const s of arr) {
    const settings = (s.settings ?? {}) as Record<string, unknown>;
    console.log(
      `  - ${String(s.name)} | ip=${String(s.ip)} | reachable=${String(settings.is_reachable ?? s.is_reachable)} | usable=${String(settings.is_usable ?? s.is_usable)}`,
    );
  }
} else {
  console.log("  not an array:", JSON.stringify(json).slice(0, 200));
}
