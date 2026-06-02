import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

/** Rumi-owned config, separate from the shared Coolify CLI config. */
export const RUMI_CONFIG_PATH = join(homedir(), ".config", "rumi", "config.json");

export interface RumiSettings {
  /** Name of the last-selected context, restored on next launch. */
  activeContext?: string;
}

/** Best-effort read; a missing or malformed file yields empty settings. */
export function loadSettings(path: string = RUMI_CONFIG_PATH): RumiSettings {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as RumiSettings;
  } catch {
    return {};
  }
}

/** Persist settings, creating ~/.config/rumi/ on first write. */
export function saveSettings(settings: RumiSettings, path: string = RUMI_CONFIG_PATH): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(settings, null, 2) + "\n", "utf8");
}
