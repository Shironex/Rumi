import {
  type ConfigField,
  type CoolifyResource,
  type CoolifyServer,
  type Deployment,
  type EnvVar,
  normalizeKind,
  parseState,
} from "./types.ts";

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

/** Sample deployment + build log for offline UI work. */
export function mockDeployment(): Deployment {
  return {
    uuid: "dep-mock",
    status: "finished",
    commit: "a1b2c3d4",
    commitMessage: "tidy build pipeline",
    lines: [
      { text: "Starting deployment of lunofi/web:main", type: "stdout", hidden: false },
      { text: "sudo docker run --rm coolify-helper", type: "command", hidden: true },
      { text: "#1 [internal] load build definition", type: "stdout", hidden: false },
      { text: "npm ci", type: "command", hidden: false },
      { text: "added 412 packages in 9s", type: "stdout", hidden: false },
      { text: "WARN deprecated transitive dep", type: "stderr", hidden: false },
      { text: "New container started. Deployment finished.", type: "stdout", hidden: false },
    ],
  };
}

/** Sample env vars (with values, so the mask/reveal toggle is exercised offline). */
export function mockEnvVars(): EnvVar[] {
  const base = { buildtime: false, runtime: true, required: false, shared: false, preview: false, multiline: false, managed: false };
  return [
    { ...base, key: "DATABASE_URL", value: "postgres://app:s3cr3t@db:5432/app", buildtime: true, required: true },
    { ...base, key: "NODE_ENV", value: "production", buildtime: true },
    { ...base, key: "LOG_LEVEL", value: "info" },
    { ...base, key: "SENTRY_DSN", value: "https://abc123@o1.ingest.sentry.io/42", shared: true },
    { ...base, key: "COOLIFY_FQDN", value: "app.example.com", managed: true },
  ];
}

/** Sample curated config for offline UI work. */
export function mockConfig(): ConfigField[] {
  return [
    { label: "status", value: "running:healthy" },
    { label: "build pack", value: "nixpacks" },
    { label: "branch", value: "main" },
    { label: "commit", value: "a1b2c3d" },
    { label: "ports exposed", value: "3000" },
    { label: "health check", value: "/health" },
    { label: "memory limit", value: "512M" },
    { label: "config hash", value: "9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c" },
  ];
}

/** Sample servers for offline UI work. */
export function mockServers(): CoolifyServer[] {
  return [
    { uuid: "srv-0", name: "production-main", ip: "193.70.35.124", description: "primary host", reachable: true, usable: true, isCoolifyHost: true, buildServer: false },
    { uuid: "srv-1", name: "production-alt", ip: "51.83.100.121", reachable: true, usable: true, isCoolifyHost: false, buildServer: true },
    { uuid: "srv-2", name: "edge-cdn", ip: "10.0.0.9", reachable: false, usable: false, isCoolifyHost: false, buildServer: false },
  ];
}

/** Sample data for offline UI work. Enable with RUMI_MOCK=1. */
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
