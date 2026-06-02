import type { ResourceState } from "../coolify/types.ts";
import { stateColor } from "../theme.ts";

/** A colored dot; a transitioning resource shows the animated spinner frame instead. */
export function StatusDot({ state, spinner }: { state: ResourceState; spinner?: string }) {
  const glyph = state === "transitioning" && spinner ? spinner : "●";
  return <text fg={stateColor(state)}>{glyph}</text>;
}
