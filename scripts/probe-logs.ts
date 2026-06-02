/**
 * Throwaway probe: discover Coolify's per-resource log endpoints + response shape.
 * Prints only a short preview (logs can contain secrets). Run: bun run scripts/probe-logs.ts
 */
import { defaultContext, loadContexts } from "../src/config.ts";

const ctx = defaultContext(loadContexts());
if (!ctx) {
  console.error("no context");
  process.exit(1);
}
const headers = { Authorization: `Bearer ${ctx.token}`, Accept: "application/json" };

const resources = (await (await fetch(`${ctx.fqdn}/api/v1/resources`, { headers })).json()) as Array<
  Record<string, unknown>
>;

function find(pred: (type: string) => boolean) {
  return resources.find((r) => pred(String(r.type ?? "")));
}
const samples: Array<[kindPath: string, r: Record<string, unknown> | undefined]> = [
  ["applications", find((t) => t === "application")],
  ["services", find((t) => t.includes("service"))],
  ["databases", find((t) => /postgres|redis|mysql|maria|mongo|keydb|dragonfly/.test(t))],
];

function preview(text: string): string {
  return text.slice(0, 160).replace(/\n/g, "\\n");
}

for (const [kindPath, r] of samples) {
  if (!r) {
    console.log(`\n[${kindPath}] no sample resource on this instance`);
    continue;
  }
  console.log(`\n[${kindPath}] sample: ${String(r.name)} (${String(r.type)})`);
  for (const path of [
    `/api/v1/${kindPath}/${String(r.uuid)}/logs?lines=20`,
    `/api/v1/${kindPath}/${String(r.uuid)}/logs`,
  ]) {
    const res = await fetch(`${ctx.fqdn}${path}`, { headers });
    const text = await res.text();
    let shape = "text";
    try {
      const j = JSON.parse(text);
      shape = Array.isArray(j) ? `json array[${j.length}]` : `json keys: ${Object.keys(j).join(",")}`;
    } catch {
      /* plain text */
    }
    console.log(`  ${path} -> ${res.status}  (${shape})`);
    console.log(`    preview: ${preview(text)}`);
    if (res.status !== 404) break;
  }
}
