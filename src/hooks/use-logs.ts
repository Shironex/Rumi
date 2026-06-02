import { useEffect, useState } from "react";
import type { CoolifyContext } from "../config.ts";
import { CoolifyClient } from "../coolify/client.ts";
import { mockLogs } from "../coolify/mock.ts";
import type { CoolifyResource } from "../coolify/types.ts";

const LOG_POLL_MS = 3000;
const LOG_LINES = 200;
const USE_MOCK = process.env.KANRISHA_MOCK === "1";

export interface LogsState {
  lines: string[];
  loading: boolean;
  error: string | null;
  /** False when Coolify's API has no log endpoint for this resource kind. */
  supported: boolean;
}

const IDLE: LogsState = { lines: [], loading: false, error: null, supported: true };

/** Tails logs for the open resource. Coolify 4.x exposes REST logs for apps only. */
export function useLogs(
  ctx: CoolifyContext | undefined,
  resource: CoolifyResource | undefined,
  active: boolean,
): LogsState {
  const [state, setState] = useState<LogsState>(IDLE);

  useEffect(() => {
    if (!active || !ctx || !resource) {
      setState(IDLE);
      return;
    }
    if (resource.kind !== "application") {
      setState({ lines: [], loading: false, error: null, supported: false });
      return;
    }
    if (USE_MOCK) {
      setState({ lines: mockLogs(resource.name), loading: false, error: null, supported: true });
      return;
    }
    const controller = new AbortController();
    setState({ lines: [], loading: true, error: null, supported: true });
    const load = async () => {
      try {
        const text = await new CoolifyClient(ctx).getApplicationLogs(resource.uuid, LOG_LINES, controller.signal);
        if (controller.signal.aborted) return;
        setState({ lines: text.split("\n"), loading: false, error: null, supported: true });
      } catch (err) {
        if (controller.signal.aborted || (err as Error).name === "AbortError") return;
        setState({ lines: [], loading: false, error: (err as Error).message, supported: true });
      }
    };
    void load();
    const timer = setInterval(load, LOG_POLL_MS);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [active, ctx, resource]);

  return state;
}
