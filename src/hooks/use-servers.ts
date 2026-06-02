import { useCallback, useEffect, useState } from "react";
import type { CoolifyContext } from "../config.ts";
import { CoolifyClient } from "../coolify/client.ts";
import { mockServers } from "../coolify/mock.ts";
import type { CoolifyServer } from "../coolify/types.ts";
import { clamp } from "../util.ts";

const POLL_MS = 10000;
const USE_MOCK = process.env.RUMI_MOCK === "1";

export interface ServersApi {
  servers: CoolifyServer[];
  loading: boolean;
  error: string | null;
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
  const [selectedIndex, setSelectedIndex] = useState(0);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!ctx) {
        setServers([]);
        setLoading(false);
        setError("No Coolify context configured.");
        return;
      }
      try {
        const list = USE_MOCK ? mockServers() : await new CoolifyClient(ctx).listServers(signal);
        if (signal?.aborted) return;
        setServers(list);
        setLoading(false);
        setError(null);
      } catch (err) {
        if (signal?.aborted || (err as Error).name === "AbortError") return;
        setLoading(false);
        setError((err as Error).message);
      }
    },
    [ctx],
  );

  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
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

  return { servers, loading, error, selected, selectedRow: servers[selected], move, refresh: () => void load() };
}
