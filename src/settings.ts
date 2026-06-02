import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

/** Kanrisha-owned config, separate from the shared Coolify CLI config. */
export const KANRISHA_CONFIG_PATH = join(homedir(), ".config", "kanrisha", "config.json");

export interface KanrishaSettings {
  /** Name of the last-selected context, restored on next launch. */
  activeContext?: string;
}

/** Best-effort read; a missing or malformed file yields empty settings. */
export function loadSettings(path: string = KANRISHA_CONFIG_PATH): KanrishaSettings {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as KanrishaSettings;
  } catch {
    return {};
  }
}

/** Persist settings, creating ~/.config/kanrisha/ on first write. */
export function saveSettings(settings: KanrishaSettings, path: string = KANRISHA_CONFIG_PATH): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(settings, null, 2) + "\n", "utf8");
}
