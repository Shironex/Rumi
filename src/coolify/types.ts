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

const DB_HINTS = [
  "postgres",
  "mysql",
  "mariadb",
  "mongo",
  "redis",
  "keydb",
  "dragonfly",
  "clickhouse",
  "database",
];

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
