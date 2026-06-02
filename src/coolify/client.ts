import type { CoolifyContext } from "../config.ts";
import { actionSegment, type LifecycleAction } from "./actions.ts";
import {
  type CoolifyResource,
  type CoolifyServer,
  type Deployment,
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
      return "API access blocked. Enable the API and allow your IP in Coolify -> Settings -> API.";
    }
    return `Coolify API error ${status}: ${body.slice(0, 140)}`;
  }
}

export class CoolifyClient {
  constructor(private readonly ctx: CoolifyContext) {}

  private headers(): Record<string, string> {
    return { Authorization: `Bearer ${this.ctx.token}`, Accept: "application/json" };
  }

  async listResources(signal?: AbortSignal): Promise<CoolifyResource[]> {
    const res = await fetch(`${this.ctx.fqdn}/api/v1/resources`, { headers: this.headers(), signal });
    if (!res.ok) throw new CoolifyApiError(res.status, await res.text());
    const data = (await res.json()) as RawResource[];
    return data.map(toResource);
  }

  async listServers(signal?: AbortSignal): Promise<CoolifyServer[]> {
    const res = await fetch(`${this.ctx.fqdn}/api/v1/servers`, { headers: this.headers(), signal });
    if (!res.ok) throw new CoolifyApiError(res.status, await res.text());
    const data = (await res.json()) as RawServer[];
    return data.map(toServer);
  }

  /** REST logs exist for standalone applications only (services/databases 404). */
  async getApplicationLogs(uuid: string, lines: number, signal?: AbortSignal): Promise<string> {
    const res = await fetch(`${this.ctx.fqdn}/api/v1/applications/${uuid}/logs?lines=${lines}`, {
      headers: this.headers(),
      signal,
    });
    if (!res.ok) throw new CoolifyApiError(res.status, await res.text());
    const data = (await res.json()) as { logs?: string };
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
    const res = await fetch(`${this.ctx.fqdn}/api/v1/deployments/applications/${appUuid}?take=${take}`, {
      headers: this.headers(),
      signal,
    });
    if (!res.ok) throw new CoolifyApiError(res.status, await res.text());
    const data = (await res.json()) as { deployments?: RawDeployment[] };
    return (data.deployments ?? []).map(toDeployment);
  }

  private async post(path: string, signal?: AbortSignal): Promise<unknown> {
    const res = await fetch(`${this.ctx.fqdn}${path}`, { method: "POST", headers: this.headers(), signal });
    if (!res.ok) throw new CoolifyApiError(res.status, await res.text());
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
