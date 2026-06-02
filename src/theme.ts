import type { ResourceState } from "./coolify/types.ts";

/** Palette tuned for dark terminals (GitHub-ish). */
export const colors = {
  running: "#3fb950",
  stopped: "#f85149",
  transitioning: "#d29922",
  degraded: "#d29922",
  unknown: "#8b949e",
  accent: "#58a6ff",
  text: "#e6edf3",
  dim: "#8b949e",
  border: "#30363d",
  selectedBg: "#1f6feb",
  selectedFg: "#ffffff",
  modalBg: "#161b22",
} as const;

export function stateColor(state: ResourceState): string {
  return colors[state];
}
