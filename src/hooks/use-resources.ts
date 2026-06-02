import { useCallback, useEffect, useRef, useState } from "react";
import { type CoolifyContext, NO_CONTEXT_MESSAGE } from "../config.ts";
import { CoolifyClient } from "../coolify/client.ts";
import { mockResources } from "../coolify/mock.ts";
import { type CoolifyResource, sortResources } from "../coolify/types.ts";
import { USE_MOCK } from "../env.ts";
import { isAbortError } from "../util.ts";

const POLL_MS = 5000;

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
        setState({ resources: [], loading: false, error: NO_CONTEXT_MESSAGE, lastUpdated: null });
        return;
      }
      try {
        const resources = USE_MOCK ? mockResources() : await new CoolifyClient(ctx).listResources(signal);
        if (signal?.aborted) return;
        setState({ resources: sortResources(resources), loading: false, error: null, lastUpdated: Date.now() });
      } catch (err) {
        if (isAbortError(err, signal)) return;
        setState((prev) => ({ ...prev, loading: false, error: (err as Error).message }));
      }
    },
    [ctx],
  );

  // Shared with refresh() so a manual refresh rides the active context's signal:
  // a context switch aborts this controller, so an in-flight refresh response is
  // dropped instead of overwriting the new context's data.
  const ctrlRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    ctrlRef.current = controller;
    setState((prev) => ({ ...prev, loading: true, error: null }));
    void load(controller.signal);
    const timer = setInterval(() => void load(controller.signal), POLL_MS);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [load]);

  const refresh = useCallback(() => void load(ctrlRef.current?.signal), [load]);

  return { ...state, refresh };
}
