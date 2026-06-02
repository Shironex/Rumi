import { readFileSync } from "node:fs";
import { configPath } from "./paths.ts";

/** Shown when no Coolify context is configured/active. */
export const NO_CONTEXT_MESSAGE = "No Coolify context configured.";

/** A single Coolify instance the user has configured, used as a "context". */
export interface CoolifyContext {
  name: string;
  /** Base URL of the instance, no trailing slash. */
  fqdn: string;
  token: string;
  default: boolean;
}

interface RawInstance {
  name?: string;
  fqdn?: string;
  token?: string;
  default?: boolean;
}

interface RawConfig {
  instances?: RawInstance[];
}

/**
 * Same file the official Coolify CLI uses (coollabsio/coolify-cli
 * internal/config.Path), so contexts are shared for free.
 */
export const COOLIFY_CONFIG_PATH = configPath("coolify");

export function loadContexts(path: string = COOLIFY_CONFIG_PATH): CoolifyContext[] {
  const raw = JSON.parse(readFileSync(path, "utf8")) as RawConfig;
  const instances = Array.isArray(raw.instances) ? raw.instances : [];
  // Skip partial entries (a missing fqdn/token can't connect) rather than letting
  // a bare `.replace` throw on the whole file for one malformed instance.
  return instances
    .filter((i): i is RawInstance & { fqdn: string } => Boolean(i?.fqdn?.trim()) && Boolean(i?.token))
    .map((i) => ({
      name: i.name ?? i.fqdn,
      fqdn: i.fqdn.replace(/\/+$/, ""),
      token: i.token ?? "",
      default: i.default ?? false,
    }));
}

/** The instance flagged `default`, falling back to the first one. */
export function defaultContext(contexts: CoolifyContext[]): CoolifyContext | undefined {
  return contexts.find((c) => c.default) ?? contexts[0];
}
