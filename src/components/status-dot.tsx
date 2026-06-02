import type { ResourceState } from "../coolify/types.ts";
import { stateColor } from "../theme.ts";

export function StatusDot({ state }: { state: ResourceState }) {
  return <text fg={stateColor(state)}>●</text>;
}
