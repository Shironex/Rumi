import { useEffect, useState } from "react";
import type { CoolifyContext } from "../config.ts";
import { CoolifyClient } from "../coolify/client.ts";
import { mockDeployment } from "../coolify/mock.ts";
import { type CoolifyResource, type Deployment, isTerminalStatus } from "../coolify/types.ts";
import { USE_MOCK } from "../env.ts";
import { isAbortError } from "../util.ts";

const POLL_MS = 2500;

export interface DeployLogsState {
  deployment: Deployment | null;
  loading: boolean;
  error: string | null;
  /** False when the resource kind has no deployment endpoint. */
  supported: boolean;
}

const IDLE: DeployLogsState = { deployment: null, loading: false, error: null, supported: true };

/**
 * Tails an application's build log. With `trackUuid` set (after an action), it
 * follows that exact deployment — race-safe: an unseen uuid keeps polling rather
 * than latching onto a stale "finished" entry. Without it, shows the latest deploy.
 */
export function useDeployLogs(
  ctx: CoolifyContext | undefined,
  resource: CoolifyResource | undefined,
  trackUuid: string | undefined,
  active: boolean,
): DeployLogsState {
  const [state, setState] = useState<DeployLogsState>(IDLE);

  useEffect(() => {
    if (!active || !ctx || !resource) {
      setState(IDLE);
      return;
    }
    if (resource.kind !== "application") {
      setState({ deployment: null, loading: false, error: null, supported: false });
      return;
    }
    if (USE_MOCK) {
      setState({ deployment: mockDeployment(), loading: false, error: null, supported: true });
      return;
    }

    const controller = new AbortController();
    setState({ deployment: null, loading: true, error: null, supported: true });

    const load = async () => {
      try {
        const take = trackUuid ? 10 : 1;
        const deps = await new CoolifyClient(ctx).getDeployments(resource.uuid, take, controller.signal);
        if (controller.signal.aborted) return;
        const dep = trackUuid ? (deps.find((d) => d.uuid === trackUuid) ?? null) : (deps[0] ?? null);
        // Tracking a freshly-queued deploy that hasn't surfaced yet is still
        // "waiting", not "no deployments" — keep loading true so the pane says so.
        const waitingForTracked = Boolean(trackUuid) && !dep;
        setState({ deployment: dep, loading: waitingForTracked, error: null, supported: true });
        // Stop polling only once the deployment we're actually showing has settled.
        if (dep && isTerminalStatus(dep.status)) clearInterval(timer);
      } catch (err) {
        if (isAbortError(err, controller.signal)) return;
        setState({ deployment: null, loading: false, error: (err as Error).message, supported: true });
      }
    };

    void load();
    const timer = setInterval(load, POLL_MS);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [active, ctx, resource, trackUuid]);

  return state;
}
