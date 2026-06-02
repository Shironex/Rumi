/**
 * Throwaway probe: discover Coolify's env + configuration endpoints and shapes.
 * Read-only (GET). NEVER prints env values (they are secrets) — only key names,
 * the object schema, and value lengths. Run: bun run scripts/probe-env.ts
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

function redact(v: unknown): string {
  if (typeof v === "string") return `<str len=${v.length}>`;
  return `<${typeof v}>`;
}

const resources = (await get("/api/v1/resources")).json as Array<Record<string, unknown>>;
const apps = resources.filter((r) => String(r.type) === "application");
const services = resources.filter((r) => String(r.type) === "service");
console.log(`applications: ${apps.length}  services: ${services.length}`);

// 1) application envs
const app = apps[0];
if (app) {
  console.log(`\n=== app envs: ${String(app.name)} ===`);
  for (const p of [`/api/v1/applications/${String(app.uuid)}/envs`]) {
    const r = await get(p);
    console.log(`GET ${p} -> ${r.status}`);
    const arr = r.json as Array<Record<string, unknown>> | undefined;
    if (Array.isArray(arr)) {
      console.log(`  array[${arr.length}]`);
      if (arr[0]) {
        console.log("  entry keys:", Object.keys(arr[0]).sort().join(", "));
        const e = arr[0];
        for (const k of Object.keys(e).sort()) {
          const isSecretish = k === "value" || k === "real_value";
          console.log(`    ${k}: ${isSecretish ? redact(e[k]) : JSON.stringify(e[k])}`);
        }
      }
      console.log(
        "  keys present:",
        arr
          .map((e) => String(e.key))
          .slice(0, 30)
          .join(", "),
      );
    } else {
      console.log("  body:", JSON.stringify(r.json ?? r).slice(0, 200));
    }
  }
}

// 2) service envs
const svc = services[0];
if (svc) {
  console.log(`\n=== service envs: ${String(svc.name)} ===`);
  const p = `/api/v1/services/${String(svc.uuid)}/envs`;
  const r = await get(p);
  console.log(`GET ${p} -> ${r.status}`);
  const arr = r.json as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(arr)) {
    console.log(`  array[${arr.length}]`);
    if (arr[0]) console.log("  entry keys:", Object.keys(arr[0]).sort().join(", "));
    console.log(
      "  keys present:",
      arr
        .map((e) => String(e.key))
        .slice(0, 30)
        .join(", "),
    );
  } else {
    console.log("  body:", JSON.stringify(r.json ?? r).slice(0, 200));
  }
}

// 3) does the application object itself carry configuration / diff fields?
if (app) {
  console.log(`\n=== application detail: ${String(app.name)} ===`);
  const r = await get(`/api/v1/applications/${String(app.uuid)}`);
  console.log(`GET /api/v1/applications/{uuid} -> ${r.status}`);
  const d = r.json as Record<string, unknown> | undefined;
  if (d) {
    const keys = Object.keys(d).sort();
    console.log("  keys:", keys.join(", "));
    const interesting = keys.filter((k) => /config|diff|compose|dockerfile|env/i.test(k));
    console.log("  config-ish keys:", interesting.join(", ") || "(none)");
    for (const k of interesting) console.log(`    ${k}: ${redact(d[k])}`);
  }
}

// 4) does a deployment carry configuration_diff?
if (app) {
  const h = await get(`/api/v1/deployments/applications/${String(app.uuid)}`);
  const arr = (h.json as { deployments?: Array<Record<string, unknown>> })?.deployments ?? [];
  if (arr[0]) {
    const depUuid = String(arr[0].deployment_uuid ?? arr[0].uuid);
    const r = await get(`/api/v1/deployments/${depUuid}`);
    const d = r.json as Record<string, unknown> | undefined;
    console.log(`\n=== deployment detail keys (${depUuid}) ===`);
    if (d) {
      const keys = Object.keys(d).sort();
      console.log("  keys:", keys.join(", "));
      console.log("  config-ish:", keys.filter((k) => /config|diff/i.test(k)).join(", ") || "(none)");
    }
  }
}
