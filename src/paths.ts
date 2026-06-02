import { homedir } from "node:os";
import { join } from "node:path";

/**
 * Per-app `config.json` location, matching where each CLI keeps it:
 * `%APPDATA%\<app>\config.json` on Windows, `~/.config/<app>/config.json` elsewhere.
 */
export function configPath(app: string): string {
  return process.platform === "win32"
    ? join(process.env.APPDATA ?? join(homedir(), "AppData", "Roaming"), app, "config.json")
    : join(homedir(), ".config", app, "config.json");
}
