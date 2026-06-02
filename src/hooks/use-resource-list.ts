import type { KeyEvent } from "@opentui/core";
import { useEffect, useMemo, useState } from "react";
import type { CoolifyContext } from "../config.ts";
import type { CoolifyResource } from "../coolify/types.ts";
import { clamp, isPrintable } from "../util.ts";
import { useResources } from "./use-resources.ts";

export interface ResourceListApi {
  filtered: CoolifyResource[];
  total: number;
  loading: boolean;
  error: string | null;
  lastUpdated: number | null;
  refresh: () => void;
  selected: number;
  selectedRow: CoolifyResource | undefined;
  move: (step: number) => void;
  filter: string;
  filterMode: boolean;
  startFilter: () => void;
  clearFilter: () => void;
  handleFilterKey: (e: KeyEvent) => void;
  counts: { running: number; problems: number };
}

/** Owns the resource feed plus its filter + selection state for one context. */
export function useResourceList(ctx: CoolifyContext | undefined): ResourceListApi {
  const { resources, loading, error, lastUpdated, refresh } = useResources(ctx);
  const [filter, setFilter] = useState("");
  const [filterMode, setFilterMode] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const filtered = useMemo(() => {
    if (!filter) return resources;
    const q = filter.toLowerCase();
    return resources.filter((r) => r.name.toLowerCase().includes(q));
  }, [resources, filter]);

  // Reset selection whenever the visible set changes meaningfully.
  useEffect(() => {
    setSelectedIndex(0);
  }, [ctx, filter]);

  const selected = clamp(selectedIndex, 0, Math.max(0, filtered.length - 1));

  const move = (step: number) => setSelectedIndex((i) => clamp(i + step, 0, Math.max(0, filtered.length - 1)));

  const handleFilterKey = (e: KeyEvent) => {
    if (e.name === "escape") {
      setFilter("");
      setFilterMode(false);
    } else if (e.name === "return" || e.name === "enter") {
      setFilterMode(false);
    } else if (e.name === "backspace") {
      setFilter((f) => f.slice(0, -1));
    } else if (isPrintable(e.sequence, e.ctrl, e.meta)) {
      setFilter((f) => f + e.sequence);
    }
  };

  const counts = useMemo(
    () => ({
      running: resources.filter((r) => r.state === "running").length,
      problems: resources.filter((r) => r.state === "stopped" || r.state === "degraded").length,
    }),
    [resources],
  );

  return {
    filtered,
    total: resources.length,
    loading,
    error,
    lastUpdated,
    refresh,
    selected,
    selectedRow: filtered[selected],
    move,
    filter,
    filterMode,
    startFilter: () => setFilterMode(true),
    clearFilter: () => setFilter(""),
    handleFilterKey,
    counts,
  };
}
