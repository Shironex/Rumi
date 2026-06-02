import type { CoolifyContext } from "../config.ts";
import { actionSegment, type LifecycleAction } from "./actions.ts";
import {
  type ConfigField,
  type CoolifyResource,
  type CoolifyServer,
  type Deployment,
  type EnvVar,
  normalizeKind,
  parseDeployLogs,
  parseState,
} from "./types.ts";

interface RawDeployment {
  deployment_uuid?: string;
  status?: string;
  commit?: string | null;
  commit_message?: string | null;
  logs?: string;
}

interface RawEnv {
  key?: string;
  value?: string;
  real_value?: string;
  is_buildtime?: boolean;
  is_runtime?: boolean;
  is_required?: boolean;
  is_really_required?: boolean;
  is_shared?: boolean;
  is_preview?: boolean;
  is_multiline?: boolean;
  is_coolify?: boolean;
}

interface RawServer {
  uuid?: string;
  name?: string;
  description?: string | null;
  ip?: string;
  is_reachable?: boolean;
  is_usable?: boolean;
  is_coolify_host?: boolean;
  settings?: { is_build_server?: boolean } | null;
}

interface RawResource {
  uuid?: string;
  name?: string;
  type?: string;
  status?: string;
  fqdn?: string | null;
  git_branch?: string | null;
  git_commit_sha?: string | null;
  git_repository?: string | null;
  build_pack?: string | null;
  server_status?: string | null;
  last_online_at?: string | null;
  updated_at?: string | null;
  description?: string | null;
}

function cleanStr(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export class CoolifyApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: string,
  ) {
    super(CoolifyApiError.explain(status, body));
    this.name = "CoolifyApiError";
  }

  private static explain(status: number, body: string): string {
    if (status === 401) return "Unauthenticated: this instance's API token is invalid or expired.";
    if (status === 403) {
      return "API access blocked. In Coolify -> Settings -> Advanced -> API Settings, turn on API Access and add your IP under Allowed IPs for API Access.";
    }
    return `Coolify API error ${status}: ${body.slice(0, 140)}`;
  }
}

/**
 * Raised when the instance can't be reached at all (DNS failure, refused
 * connection, TLS error, timeout) — i.e. `fetch` threw before any HTTP status.
 * Carries actionable copy instead of Bun's terse "Unable to connect".
 */
export class CoolifyConnectionError extends Error {
  constructor(
    readonly contextName: string,
    readonly fqdn: string,
    override readonly cause: Error,
  ) {
    super(`Can't reach "${contextName}" (${fqdn}). Check the instance is online and the URL is correct.`);
    this.name = "CoolifyConnectionError";
  }
}

/**
 * Raised when a request succeeds (2xx) but the body isn't the Coolify API JSON we
 * expect — typically the fqdn points at a proxy, login page, or the wrong host.
 * Without this, the raw `JSON.parse` SyntaxError would leak into the pane.
 */
export class CoolifyResponseError extends Error {
  constructor(
    readonly contextName: string,
    readonly fqdn: string,
  ) {
    super(`"${contextName}" (${fqdn}) didn't return Coolify API data. Make sure the URL points at your instance, not a proxy or login page.`);
    this.name = "CoolifyResponseError";
  }
}

export class CoolifyClient {
  constructor(private readonly ctx: CoolifyContext) {}

  private headers(): Record<string, string> {
    return { Authorization: `Bearer ${this.ctx.token}`, Accept: "application/json" };
  }

  /**
   * Single fetch chokepoint: turns a thrown network error into a friendly
   * {@link CoolifyConnectionError} (aborts pass through untouched) and a non-2xx
   * response into a {@link CoolifyApiError}, so every caller surfaces consistent,
   * actionable messages instead of raw runtime errors.
   */
  private async request(path: string, init: RequestInit | undefined, signal: AbortSignal | undefined): Promise<Response> {
    let res: Response;
    try {
      res = await fetch(`${this.ctx.fqdn}${path}`, { ...init, headers: this.headers(), signal });
    } catch (err) {
      if (signal?.aborted || (err as Error).name === "AbortError") throw err;
      throw new CoolifyConnectionError(this.ctx.name, this.ctx.fqdn, err as Error);
    }
    if (!res.ok) throw new CoolifyApiError(res.status, await res.text());
    return res;
  }

  /**
   * GET + JSON parse through the {@link request} chokepoint. A 2xx body that isn't
   * JSON (proxy/login interstitial) becomes a {@link CoolifyResponseError} rather
   * than a raw SyntaxError — and is never swallowed into a misleading empty result.
   */
  private async getJson<T>(path: string, signal: AbortSignal | undefined): Promise<T> {
    const res = await this.request(path, undefined, signal);
    const text = await res.text();
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new CoolifyResponseError(this.ctx.name, this.ctx.fqdn);
    }
  }

  async listResources(signal?: AbortSignal): Promise<CoolifyResource[]> {
    const data = await this.getJson<RawResource[]>(`/api/v1/resources`, signal);
    return data.map(toResource);
  }

  async listServers(signal?: AbortSignal): Promise<CoolifyServer[]> {
    const data = await this.getJson<RawServer[]>(`/api/v1/servers`, signal);
    return data.map(toServer);
  }

  /** REST logs exist for standalone applications only (services/databases 404). */
  async getApplicationLogs(uuid: string, lines: number, signal?: AbortSignal): Promise<string> {
    const data = await this.getJson<{ logs?: string }>(`/api/v1/applications/${uuid}/logs?lines=${lines}`, signal);
    return data.logs ?? "";
  }

  /**
   * start / stop / restart a resource (Coolify accepts POST). Returns the
   * deployment_uuid when the action queued a build (app start/restart), else undefined.
   */
  async runAction(resource: CoolifyResource, action: LifecycleAction, signal?: AbortSignal): Promise<string | undefined> {
    const segment = actionSegment(resource.kind);
    if (!segment) throw new Error(`No lifecycle endpoint for a ${resource.kind} resource.`);
    const body = await this.post(`/api/v1/${segment}/${resource.uuid}/${action}`, signal);
    return extractDeploymentUuid(body);
  }

  /** Trigger a (re)deploy by uuid; returns the queued deployment_uuid. */
  async deploy(uuid: string, signal?: AbortSignal): Promise<string | undefined> {
    const body = await this.post(`/api/v1/deploy?uuid=${encodeURIComponent(uuid)}&force=false`, signal);
    return extractDeploymentUuid(body);
  }

  /** Recent deployments for an app, newest first; each carries its parsed build log. */
  async getDeployments(appUuid: string, take: number, signal?: AbortSignal): Promise<Deployment[]> {
    const data = await this.getJson<{ deployments?: RawDeployment[] }>(
      `/api/v1/deployments/applications/${appUuid}?take=${take}`,
      signal,
    );
    return (data.deployments ?? []).map(toDeployment);
  }

  /** Env vars for an app/service. Values come back only with a sensitive-read token. */
  async getEnvVars(resource: CoolifyResource, signal?: AbortSignal): Promise<EnvVar[]> {
    const segment = actionSegment(resource.kind);
    if (segment !== "applications" && segment !== "services") return [];
    const data = await this.getJson<RawEnv[]>(`/api/v1/${segment}/${resource.uuid}/envs`, signal);
    return (Array.isArray(data) ? data : []).map(toEnvVar);
  }

  /** Curated deployment configuration for an app/service, read off the detail object. */
  async getConfig(resource: CoolifyResource, signal?: AbortSignal): Promise<ConfigField[]> {
    const segment = actionSegment(resource.kind);
    if (segment !== "applications" && segment !== "services") return [];
    const raw = await this.getJson<Record<string, unknown>>(`/api/v1/${segment}/${resource.uuid}`, signal);
    return curateConfig(raw);
  }

  private async post(path: string, signal?: AbortSignal): Promise<unknown> {
    const res = await this.request(path, { method: "POST" }, signal);
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      return {};
    }
  }
}

/** Pull a deployment_uuid out of an action response (top-level or deployments[0]). */
function extractDeploymentUuid(body: unknown): string | undefined {
  if (!body || typeof body !== "object") return undefined;
  const b = body as Record<string, unknown>;
  if (typeof b.deployment_uuid === "string") return b.deployment_uuid;
  const deps = b.deployments;
  if (Array.isArray(deps) && deps[0] && typeof deps[0] === "object") {
    const first = deps[0] as Record<string, unknown>;
    if (typeof first.deployment_uuid === "string") return first.deployment_uuid;
  }
  return undefined;
}

function toDeployment(raw: RawDeployment): Deployment {
  return {
    uuid: raw.deployment_uuid ?? "",
    status: raw.status ?? "unknown",
    commit: cleanStr(raw.commit),
    commitMessage: cleanStr(raw.commit_message),
    lines: parseDeployLogs(raw.logs),
  };
}

function toEnvVar(raw: RawEnv): EnvVar {
  // Preserve an explicit empty string (a set-but-empty var); only undefined means "hidden".
  const value =
    typeof raw.value === "string" ? raw.value : typeof raw.real_value === "string" ? raw.real_value : undefined;
  return {
    key: raw.key ?? "",
    value,
    buildtime: raw.is_buildtime ?? false,
    runtime: raw.is_runtime ?? false,
    required: (raw.is_required ?? false) || (raw.is_really_required ?? false),
    shared: raw.is_shared ?? false,
    preview: raw.is_preview ?? false,
    multiline: raw.is_multiline ?? false,
    managed: raw.is_coolify ?? false,
  };
}

/** Detail-object keys worth surfacing, in display order. Missing/empty ones drop out. */
const CONFIG_FIELDS: ReadonlyArray<readonly [label: string, key: string]> = [
  ["status", "status"],
  ["build pack", "build_pack"],
  ["branch", "git_branch"],
  ["commit", "git_commit_sha"],
  ["repository", "git_repository"],
  ["dockerfile", "dockerfile_location"],
  ["compose", "docker_compose_location"],
  ["ports exposed", "ports_exposes"],
  ["ports mapped", "ports_mappings"],
  ["health check", "health_check_path"],
  ["memory limit", "limits_memory"],
  ["cpu limit", "limits_cpus"],
  ["install cmd", "install_command"],
  ["build cmd", "build_command"],
  ["start cmd", "start_command"],
  ["pre deploy", "pre_deployment_command"],
  ["post deploy", "post_deployment_command"],
  ["last online", "last_online_at"],
  ["config hash", "config_hash"],
];

function curateConfig(raw: Record<string, unknown>): ConfigField[] {
  const fields: ConfigField[] = [];
  for (const [label, key] of CONFIG_FIELDS) {
    const v = raw[key];
    if (v === null || v === undefined) continue;
    let str = typeof v === "string" ? v.trim() : typeof v === "number" || typeof v === "boolean" ? String(v) : "";
    if (!str || str === "0") continue;
    if (key === "git_commit_sha") str = str.slice(0, 7);
    fields.push({ label, value: str });
  }
  return fields;
}

function toServer(raw: RawServer): CoolifyServer {
  return {
    uuid: raw.uuid ?? "",
    name: raw.name ?? "(unnamed)",
    description: cleanStr(raw.description),
    ip: raw.ip ?? "",
    reachable: raw.is_reachable ?? false,
    usable: raw.is_usable ?? false,
    isCoolifyHost: raw.is_coolify_host ?? false,
    buildServer: raw.settings?.is_build_server ?? false,
  };
}

function toResource(raw: RawResource): CoolifyResource {
  const rawType = raw.type ?? "unknown";
  const status = raw.status ?? "unknown";
  return {
    uuid: raw.uuid ?? "",
    name: raw.name ?? "(unnamed)",
    rawType,
    kind: normalizeKind(rawType),
    status,
    state: parseState(status),
    meta: {
      fqdn: cleanStr(raw.fqdn),
      gitBranch: cleanStr(raw.git_branch),
      gitCommitSha: cleanStr(raw.git_commit_sha),
      gitRepository: cleanStr(raw.git_repository),
      buildPack: cleanStr(raw.build_pack),
      serverStatus: cleanStr(raw.server_status),
      lastOnlineAt: cleanStr(raw.last_online_at),
      updatedAt: cleanStr(raw.updated_at),
      description: cleanStr(raw.description),
    },
  };
}
