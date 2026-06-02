import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { configPath } from "./paths.ts";

/** Rumi-owned config, separate from the shared Coolify CLI config. */
export const RUMI_CONFIG_PATH = configPath("rumi");

export interface RumiSettings {
  /** Name of the last-selected context, restored on next launch. */
  activeContext?: string;
}

/** Best-effort read; a missing, malformed, or non-object file yields empty settings. */
export function loadSettings(path: string = RUMI_CONFIG_PATH): RumiSettings {
  try {
    // `JSON.parse("null")` succeeds and returns null, which would crash callers
    // that read `.activeContext`; treat any non-object as empty settings.
    const parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as RumiSettings) : {};
  } catch {
    return {};
  }
}

/** Persist settings, creating ~/.config/rumi/ on first write. */
export function saveSettings(settings: RumiSettings, path: string = RUMI_CONFIG_PATH): void {
  mkdirSync(dirname(path), { recursive: true });
  // Write to a sibling temp file then rename over the target so a crash mid-write
  // can't leave a truncated config.json (rename is atomic on the same filesystem).
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, JSON.stringify(settings, null, 2) + "\n", "utf8");
  renameSync(tmp, path);
}
