import { type CoolifyResource, normalizeKind, parseState } from "./types.ts";

const SAMPLES: ReadonlyArray<readonly [name: string, rawType: string, status: string]> = [
  ["lunofi-api", "application", "running:healthy"],
  ["lunofi-web", "application", "running:healthy"],
  ["worker", "application", "exited:unhealthy"],
  ["postgres", "standalone-postgresql", "running:healthy"],
  ["redis", "standalone-redis", "running:unknown"],
  ["grafana", "service", "running:healthy"],
  ["promtail", "service", "restarting:unhealthy"],
];

/** Sample log lines for offline UI work. */
export function mockLogs(name: string): string[] {
  return [
    `[12:00:01] INFO  ${name} starting up`,
    `[12:00:01] INFO  listening on :3000`,
    `[12:00:02] DEBUG cache warmed (142 keys)`,
    `[12:00:03] INFO  GET /health 200 3ms`,
    `[12:00:04] WARN  slow query took 812ms`,
    `[12:00:05] INFO  GET /api/v1/resources 200 41ms`,
    `[12:00:06] ERROR upstream timeout, retrying (1/3)`,
    `[12:00:07] INFO  upstream reconnected`,
  ];
}

/** Sample data for offline UI work. Enable with KANRISHA_MOCK=1. */
export function mockResources(): CoolifyResource[] {
  return SAMPLES.map(([name, rawType, status], i) => {
    const isApp = rawType === "application";
    return {
      uuid: `mock-${i}`,
      name,
      rawType,
      kind: normalizeKind(rawType),
      status,
      state: parseState(status),
      meta: {
        fqdn: isApp ? `https://${name}.example.com` : undefined,
        gitBranch: isApp ? "main" : undefined,
        gitCommitSha: isApp ? "a1b2c3d4e5f6" : undefined,
        gitRepository: isApp ? `git@github.com:lunofi/${name}.git` : undefined,
        buildPack: isApp ? "nixpacks" : undefined,
        serverStatus: "running",
        lastOnlineAt: "2026-06-02T11:00:00Z",
        updatedAt: "2026-06-02T10:30:00Z",
      },
    };
  });
}
