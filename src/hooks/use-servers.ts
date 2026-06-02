import { useCallback, useEffect, useRef, useState } from "react";
import { type CoolifyContext, NO_CONTEXT_MESSAGE } from "../config.ts";
import { CoolifyClient } from "../coolify/client.ts";
import { mockServers } from "../coolify/mock.ts";
import type { CoolifyServer } from "../coolify/types.ts";
import { USE_MOCK } from "../env.ts";
import { clamp, isAbortError } from "../util.ts";

const POLL_MS = 10000;

export interface ServersApi {
  servers: CoolifyServer[];
  loading: boolean;
  error: string | null;
  /** When the list last loaded, so the pane can show freshness like the resources view. */
  lastUpdated: number | null;
  selected: number;
  selectedRow: CoolifyServer | undefined;
  move: (step: number) => void;
  refresh: () => void;
}

/** Loads servers only while the servers view is `active`; polls slowly (they rarely change). */
export function useServers(ctx: CoolifyContext | undefined, active: boolean): ServersApi {
  const [servers, setServers] = useState<CoolifyServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!ctx) {
        setServers([]);
        setLoading(false);
        setError(NO_CONTEXT_MESSAGE);
        return;
      }
      try {
        const list = USE_MOCK ? mockServers() : await new CoolifyClient(ctx).listServers(signal);
        if (signal?.aborted) return;
        setServers(list);
        setLoading(false);
        setError(null);
        setLastUpdated(Date.now());
      } catch (err) {
        if (isAbortError(err, signal)) return;
        setLoading(false);
        setError((err as Error).message);
      }
    },
    [ctx],
  );

  // See use-resources: refresh() rides the active controller's signal so a
  // stale refresh can't overwrite the new context after a switch.
  const ctrlRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    ctrlRef.current = controller;
    setLoading(true);
    setError(null);
    void load(controller.signal);
    const timer = setInterval(() => void load(controller.signal), POLL_MS);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [active, load]);

  const selected = clamp(selectedIndex, 0, Math.max(0, servers.length - 1));
  const move = (step: number) => setSelectedIndex((i) => clamp(i + step, 0, Math.max(0, servers.length - 1)));

  return {
    servers,
    loading,
    error,
    lastUpdated,
    selected,
    selectedRow: servers[selected],
    move,
    refresh: () => void load(ctrlRef.current?.signal),
  };
}
