import { useState } from "react";
import { type CoolifyContext, loadContexts } from "../config.ts";
import { clamp } from "../util.ts";

function loadSafe(): CoolifyContext[] {
  try {
    return loadContexts();
  } catch {
    return [];
  }
}

export interface ContextsApi {
  contexts: CoolifyContext[];
  activeIndex: number;
  active: CoolifyContext | undefined;
  move: (step: number) => void;
}

/** Loads Coolify contexts once and tracks the active one. */
export function useContexts(): ContextsApi {
  const init = useState(() => {
    const list = loadSafe();
    return { list, defaultIndex: Math.max(0, list.findIndex((c) => c.default)) };
  })[0];
  const [activeIndex, setActiveIndex] = useState(init.defaultIndex);

  const move = (step: number) =>
    setActiveIndex((i) => clamp(i + step, 0, Math.max(0, init.list.length - 1)));

  return { contexts: init.list, activeIndex, active: init.list[activeIndex], move };
}
