import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/** A single Coolify instance the user has configured, used as a "context". */
export interface CoolifyContext {
  name: string;
  /** Base URL of the instance, no trailing slash. */
  fqdn: string;
  token: string;
  default: boolean;
}

interface RawInstance {
  name: string;
  fqdn: string;
  token: string;
  default?: boolean;
}

interface RawConfig {
  instances?: RawInstance[];
}

/** Same file the official Coolify CLI uses, so contexts are shared for free. */
export const COOLIFY_CONFIG_PATH = join(homedir(), ".config", "coolify", "config.json");

export function loadContexts(path: string = COOLIFY_CONFIG_PATH): CoolifyContext[] {
  const raw = JSON.parse(readFileSync(path, "utf8")) as RawConfig;
  return (raw.instances ?? []).map((i) => ({
    name: i.name,
    fqdn: i.fqdn.replace(/\/+$/, ""),
    token: i.token,
    default: i.default ?? false,
  }));
}

/** The instance flagged `default`, falling back to the first one. */
export function defaultContext(contexts: CoolifyContext[]): CoolifyContext | undefined {
  return contexts.find((c) => c.default) ?? contexts[0];
}
