/**
 * Throwaway probe: discover Coolify's deployment endpoints + the deploy-log shape.
 * All read-only (GET). Previews only a short slice (deploy logs can hold secrets).
 * Run: bun run scripts/probe-deploy.ts
 */
import { defaultContext, loadContexts } from "../src/config.ts";

const ctx = defaultContext(loadContexts());
if (!ctx) {
  console.error("no context");
  process.exit(1);
}
const headers = { Authorization: `Bearer ${ctx.token}`, Accept: "application/json" };

async function get(path: string) {
  const res = await fetch(`${ctx!.fqdn}${path}`, { headers });
  const text = await res.text();
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { status: res.status, text };
  }
  return { status: res.status, json };
}

// 1) scan applications for one with deployment history
const resources = (await get("/api/v1/resources")).json as Array<Record<string, unknown>>;
const apps = resources.filter((r) => String(r.type) === "application");
console.log(`applications: ${apps.length}`);

let recentUuid: string | undefined;
for (const app of apps) {
  const h = await get(`/api/v1/deployments/applications/${String(app.uuid)}`);
  const arr = (h.json as { deployments?: Array<Record<string, unknown>> })?.deployments ?? [];
  if (arr.length) {
    console.log(`\n${String(app.name)} (${String(app.uuid)}) -> ${arr.length} deployments`);
    const histKeys = Object.keys(arr[0]!).sort();
    console.log("  entry keys:", histKeys.join(", "));
    for (const d of arr.slice(0, 5)) {
      console.log(
        `   - ${String(d.deployment_uuid ?? d.uuid)} | status=${String(d.status)} | ${String(d.created_at ?? "")}`,
      );
    }
    recentUuid = String(arr[0]!.deployment_uuid ?? arr[0]!.uuid);
    const logs = arr[0]!.logs;
    console.log("\n  logs typeof:", typeof logs);
    if (typeof logs === "string") {
      try {
        const parsed = JSON.parse(logs);
        if (Array.isArray(parsed)) {
          console.log("  logs[] length:", parsed.length);
          if (parsed[0]) console.log("  logs[] entry keys:", Object.keys(parsed[0]).sort().join(", "));
          for (const e of parsed.slice(0, 4)) {
            console.log(
              `   [${String((e as Record<string, unknown>).type)}] ${String((e as Record<string, unknown>).output)
                .slice(0, 80)
                .replace(/\n/g, "\\n")}`,
            );
          }
        }
      } catch {
        console.log("  logs preview:", logs.slice(0, 160).replace(/\n/g, "\\n"));
      }
    }
    break;
  }
}
if (!recentUuid) console.log("\nno deployment history found on any application");

// 4) one deployment detail + log shape
if (recentUuid) {
  const detail = await get(`/api/v1/deployments/${recentUuid}`);
  console.log(`\nGET /api/v1/deployments/${recentUuid} -> ${detail.status}`);
  const d = detail.json as Record<string, unknown> | undefined;
  if (d) {
    console.log("  keys:", Object.keys(d).sort().join(", "));
    console.log("  status:", String(d.status));
    const logs = d.logs;
    console.log("  logs typeof:", typeof logs);
    if (typeof logs === "string") {
      console.log("  logs preview:", logs.slice(0, 200).replace(/\n/g, "\\n"));
      try {
        const parsed = JSON.parse(logs);
        if (Array.isArray(parsed) && parsed[0]) {
          console.log("  logs[] entry keys:", Object.keys(parsed[0]).sort().join(", "));
          console.log("  logs[0]:", JSON.stringify(parsed[0]).slice(0, 200));
        }
      } catch {
        console.log("  (logs is a plain string, not JSON-encoded)");
      }
    }
  }
}
