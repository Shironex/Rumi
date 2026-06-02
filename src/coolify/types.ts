/** Normalized resource buckets we render in the table. */
export type ResourceKind = "application" | "service" | "database" | "unknown";

/** Normalized docker lifecycle state, derived from Coolify's `status` string. */
export type ResourceState = "running" | "stopped" | "transitioning" | "degraded" | "unknown";

/** Extra fields surfaced in the detail pane (all optional — instances vary). */
export interface ResourceMeta {
  fqdn?: string;
  gitBranch?: string;
  gitCommitSha?: string;
  gitRepository?: string;
  buildPack?: string;
  serverStatus?: string;
  lastOnlineAt?: string;
  updatedAt?: string;
  description?: string;
}

export interface CoolifyResource {
  uuid: string;
  name: string;
  /** Raw Coolify type, e.g. "application", "standalone-postgresql", "service". */
  rawType: string;
  kind: ResourceKind;
  /** Raw status, e.g. "running:healthy", "exited:unhealthy", "running:unknown". */
  status: string;
  state: ResourceState;
  meta: ResourceMeta;
}

/**
 * One environment variable for a resource. `value` is present only when the API
 * token carries the sensitive-read scope; a plain read token gets it stripped,
 * so we render keys + scope flags and note that values are hidden.
 */
export interface EnvVar {
  key: string;
  value?: string;
  buildtime: boolean;
  runtime: boolean;
  required: boolean;
  shared: boolean;
  preview: boolean;
  multiline: boolean;
  /** Managed by Coolify itself (injected platform var), not user-defined. */
  managed: boolean;
}

/** One curated line in the config inspector (label + already-stringified value). */
export interface ConfigField {
  label: string;
  value: string;
}

/** Compact scope tags for an env var, e.g. ["build", "runtime", "required"]. */
export function envScopeTags(env: EnvVar): string[] {
  const tags: string[] = [];
  if (env.buildtime) tags.push("build");
  if (env.runtime) tags.push("runtime");
  if (env.required) tags.push("required");
  if (env.shared) tags.push("shared");
  if (env.preview) tags.push("preview");
  if (env.multiline) tags.push("multiline");
  if (env.managed) tags.push("system");
  return tags;
}

/** One line of build/deploy output. `command` lines are the shell steps Coolify ran. */
export type DeployLogType = "stdout" | "stderr" | "command";

export interface DeployLogLine {
  text: string;
  type: DeployLogType;
  /** Coolify marks internal/debug steps hidden; the web UI omits them by default. */
  hidden: boolean;
}

export interface Deployment {
  uuid: string;
  /** Raw status: queued | in_progress | finished | failed | cancelled-by-user | ... */
  status: string;
  commit?: string;
  commitMessage?: string;
  lines: DeployLogLine[];
}

const TERMINAL_STATUSES = ["finished", "failed", "error"];

/** True once a deployment has stopped progressing (used to halt polling). */
export function isTerminalStatus(status: string): boolean {
  const s = status.toLowerCase();
  return TERMINAL_STATUSES.includes(s) || s.includes("cancel");
}

interface RawDeployLog {
  output?: string;
  type?: string;
  hidden?: boolean;
}

/** Coolify stores deploy logs as a JSON-encoded string of typed entries. */
export function parseDeployLogs(raw: string | undefined): DeployLogLine[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return (parsed as RawDeployLog[]).map((e) => ({
    text: typeof e.output === "string" ? e.output : "",
    type: e.type === "stderr" ? "stderr" : e.type === "command" ? "command" : "stdout",
    hidden: e.hidden === true,
  }));
}

/** A Coolify host, from GET /api/v1/servers (separate from /resources). */
export interface CoolifyServer {
  uuid: string;
  name: string;
  description?: string;
  ip: string;
  reachable: boolean;
  usable: boolean;
  isCoolifyHost: boolean;
  buildServer: boolean;
}

const DB_HINTS = ["postgres", "mysql", "mariadb", "mongo", "redis", "keydb", "dragonfly", "clickhouse", "database"];

export function normalizeKind(rawType: string): ResourceKind {
  const t = rawType.toLowerCase();
  if (t.includes("application")) return "application";
  if (DB_HINTS.some((h) => t.includes(h))) return "database";
  if (t.includes("service")) return "service";
  return "unknown";
}

/** Coolify reports `status` as `<dockerState>:<health>`, e.g. "running:healthy". */
export function parseState(status: string): ResourceState {
  const s = status.toLowerCase();
  const dockerState = (s.split(":")[0] ?? "").trim();
  if (s.includes("degraded")) return "degraded";
  if (dockerState === "running") return s.includes("unhealthy") ? "degraded" : "running";
  if (["exited", "stopped", "dead", "removing"].includes(dockerState)) return "stopped";
  if (["restarting", "starting", "created", "deploying", "building"].includes(dockerState)) {
    return "transitioning";
  }
  return "unknown";
}

export function shortKind(kind: ResourceKind): string {
  switch (kind) {
    case "application":
      return "app";
    case "database":
      return "db";
    case "service":
      return "svc";
    default:
      return "?";
  }
}

const KIND_ORDER: Record<ResourceKind, number> = {
  application: 0,
  database: 1,
  service: 2,
  unknown: 3,
};

/** Group by kind, then alphabetical, for a stable scannable list. */
export function sortResources(list: CoolifyResource[]): CoolifyResource[] {
  return [...list].sort((a, b) => {
    const byKind = KIND_ORDER[a.kind] - KIND_ORDER[b.kind];
    return byKind !== 0 ? byKind : a.name.localeCompare(b.name);
  });
}
