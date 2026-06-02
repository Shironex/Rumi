import { useCallback, useEffect, useState } from "react";
import type { CoolifyContext } from "../config.ts";
import { CoolifyClient } from "../coolify/client.ts";
import { mockResources } from "../coolify/mock.ts";
import { type CoolifyResource, sortResources } from "../coolify/types.ts";

const POLL_MS = 5000;
const USE_MOCK = process.env.RUMI_MOCK === "1";

export interface ResourcesState {
  resources: CoolifyResource[];
  loading: boolean;
  error: string | null;
  lastUpdated: number | null;
}

const INITIAL: ResourcesState = {
  resources: [],
  loading: true,
  error: null,
  lastUpdated: null,
};

/** Fetches and polls resources for the active context, abort-safe across switches. */
export function useResources(ctx: CoolifyContext | undefined): ResourcesState & { refresh: () => void } {
  const [state, setState] = useState<ResourcesState>(INITIAL);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!ctx) {
        setState({ resources: [], loading: false, error: "No Coolify context configured.", lastUpdated: null });
        return;
      }
      try {
        const resources = USE_MOCK ? mockResources() : await new CoolifyClient(ctx).listResources(signal);
        if (signal?.aborted) return;
        setState({ resources: sortResources(resources), loading: false, error: null, lastUpdated: Date.now() });
      } catch (err) {
        if (signal?.aborted || (err as Error).name === "AbortError") return;
        setState((prev) => ({ ...prev, loading: false, error: (err as Error).message }));
      }
    },
    [ctx],
  );

  useEffect(() => {
    const controller = new AbortController();
    setState((prev) => ({ ...prev, loading: true, error: null }));
    void load(controller.signal);
    const timer = setInterval(() => void load(controller.signal), POLL_MS);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [load]);

  const refresh = useCallback(() => void load(), [load]);

  return { ...state, refresh };
}
