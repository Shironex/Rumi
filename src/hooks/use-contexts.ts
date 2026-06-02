import { useState } from "react";
import { type CoolifyContext, loadContexts } from "../config.ts";
import { mockContexts } from "../coolify/mock.ts";
import { USE_MOCK } from "../env.ts";
import { loadSettings, saveSettings } from "../settings.ts";
import { clamp } from "../util.ts";

interface LoadResult {
  contexts: CoolifyContext[];
  /** Set only when a config file exists but couldn't be read/parsed — not first-run. */
  error: string | null;
}

function loadSafe(): LoadResult {
  if (USE_MOCK) return { contexts: mockContexts(), error: null };
  try {
    return { contexts: loadContexts(), error: null };
  } catch (err) {
    // A missing file is the normal first-run → onboarding, no error. Any other
    // failure means a config exists that we couldn't read; surface it instead of
    // masquerading as "nothing configured".
    if ((err as { code?: string }).code === "ENOENT") return { contexts: [], error: null };
    return { contexts: [], error: (err as Error).message };
  }
}

/** Initial active index: last-saved context name, else the `default` flag, else first. */
function initialIndex(list: CoolifyContext[]): number {
  const savedName = loadSettings().activeContext;
  const savedIdx = savedName ? list.findIndex((c) => c.name === savedName) : -1;
  if (savedIdx >= 0) return savedIdx;
  return Math.max(
    0,
    list.findIndex((c) => c.default),
  );
}

export interface ContextsApi {
  contexts: CoolifyContext[];
  activeIndex: number;
  active: CoolifyContext | undefined;
  move: (step: number) => void;
  /** Pick a context by index and remember it for next launch. */
  select: (index: number) => void;
  /** Set when a config file exists but couldn't be read — distinct from first-run. */
  error: string | null;
}

/** Loads Coolify contexts once, tracks the active one, and persists the choice. */
export function useContexts(): ContextsApi {
  const initial = useState(loadSafe)[0];
  const list = initial.contexts;
  const [activeIndex, setActiveIndex] = useState(() => initialIndex(list));

  const move = (step: number) => setActiveIndex((i) => clamp(i + step, 0, Math.max(0, list.length - 1)));

  const select = (index: number) => {
    const i = clamp(index, 0, Math.max(0, list.length - 1));
    setActiveIndex(i);
    const chosen = list[i];
    if (chosen && !USE_MOCK) saveSettings({ activeContext: chosen.name });
  };

  return { contexts: list, activeIndex, active: list[activeIndex], move, select, error: initial.error };
}
