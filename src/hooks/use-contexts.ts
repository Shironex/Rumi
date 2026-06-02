import { useState } from "react";
import { type CoolifyContext, loadContexts } from "../config.ts";
import { mockContexts } from "../coolify/mock.ts";
import { loadSettings, saveSettings } from "../settings.ts";
import { clamp } from "../util.ts";

const USE_MOCK = process.env.RUMI_MOCK === "1";

function loadSafe(): CoolifyContext[] {
  if (USE_MOCK) return mockContexts();
  try {
    return loadContexts();
  } catch {
    return [];
  }
}

/** Initial active index: last-saved context name, else the `default` flag, else first. */
function initialIndex(list: CoolifyContext[]): number {
  const savedName = loadSettings().activeContext;
  const savedIdx = savedName ? list.findIndex((c) => c.name === savedName) : -1;
  if (savedIdx >= 0) return savedIdx;
  return Math.max(0, list.findIndex((c) => c.default));
}

export interface ContextsApi {
  contexts: CoolifyContext[];
  activeIndex: number;
  active: CoolifyContext | undefined;
  move: (step: number) => void;
  /** Pick a context by index and remember it for next launch. */
  select: (index: number) => void;
}

/** Loads Coolify contexts once, tracks the active one, and persists the choice. */
export function useContexts(): ContextsApi {
  const list = useState(loadSafe)[0];
  const [activeIndex, setActiveIndex] = useState(() => initialIndex(list));

  const move = (step: number) =>
    setActiveIndex((i) => clamp(i + step, 0, Math.max(0, list.length - 1)));

  const select = (index: number) => {
    const i = clamp(index, 0, Math.max(0, list.length - 1));
    setActiveIndex(i);
    const chosen = list[i];
    if (chosen && !USE_MOCK) saveSettings({ activeContext: chosen.name });
  };

  return { contexts: list, activeIndex, active: list[activeIndex], move, select };
}
