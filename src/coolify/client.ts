import type { CoolifyContext } from "../config.ts";
import { actionSegment, type LifecycleAction } from "./actions.ts";
import { type CoolifyResource, normalizeKind, parseState } from "./types.ts";

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

  /** start / stop / restart a resource. Coolify accepts POST (and GET) on these. */
  async runAction(resource: CoolifyResource, action: LifecycleAction, signal?: AbortSignal): Promise<void> {
    const segment = actionSegment(resource.kind);
    if (!segment) throw new Error(`No lifecycle endpoint for a ${resource.kind} resource.`);
    await this.post(`/api/v1/${segment}/${resource.uuid}/${action}`, signal);
  }

  /** Trigger a (re)deploy by uuid. force=false reuses the build cache where possible. */
  async deploy(uuid: string, signal?: AbortSignal): Promise<void> {
    await this.post(`/api/v1/deploy?uuid=${encodeURIComponent(uuid)}&force=false`, signal);
  }

  private async post(path: string, signal?: AbortSignal): Promise<void> {
    const res = await fetch(`${this.ctx.fqdn}${path}`, { method: "POST", headers: this.headers(), signal });
    if (!res.ok) throw new CoolifyApiError(res.status, await res.text());
  }
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
