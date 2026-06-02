import { TextAttributes } from "@opentui/core";
import { colors } from "../theme.ts";

interface Props {
  contextName?: string;
  loading: boolean;
  error: string | null;
  running: number;
  problems: number;
  lastUpdated: number | null;
  total: number;
}

function clockOf(ts: number | null): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleTimeString();
}

export function HeaderBar({ contextName, loading, error, running, problems, lastUpdated, total }: Props) {
  return (
    <box flexDirection="row">
      <text fg={colors.accent} attributes={TextAttributes.BOLD}>
        kanrisha
      </text>
      <text fg={colors.dim}>{`  ${contextName ?? "no context"}  `}</text>
      {error ? (
        <text fg={colors.stopped}>API error</text>
      ) : loading && total === 0 ? (
        <text fg={colors.dim}>loading…</text>
      ) : (
        <box flexDirection="row">
          <text fg={colors.running}>●</text>
          <text fg={colors.dim}>{` ${running} up   `}</text>
          <text fg={colors.stopped}>●</text>
          <text fg={colors.dim}>{` ${problems} down   updated ${clockOf(lastUpdated)}`}</text>
        </box>
      )}
    </box>
  );
}
