import type { ReactNode } from "react";
import type { CoolifyServer } from "../coolify/types.ts";
import { colors } from "../theme.ts";

interface Props {
  servers: CoolifyServer[];
  selectedIndex: number;
  loading: boolean;
  error: string | null;
  /** Last successful load, shown in the title for freshness (parity with the resources view). */
  lastUpdated?: number | null;
  viewportHeight: number;
}

const NAME_WIDTH = 24;
const IP_WIDTH = 18;

function pad(value: string, width: number): string {
  return value.length > width ? value.slice(0, width - 1) + "…" : value.padEnd(width);
}

function healthColor(s: CoolifyServer): string {
  if (!s.reachable) return colors.stopped;
  if (!s.usable) return colors.degraded;
  return colors.running;
}

function healthLabel(s: CoolifyServer): string {
  if (!s.reachable) return "unreachable";
  if (!s.usable) return "unusable";
  return "ready";
}

export function ServersPane({ servers, selectedIndex, loading, error, lastUpdated, viewportHeight }: Props) {
  const title = ` servers (${servers.length})${lastUpdated ? ` · ${new Date(lastUpdated).toLocaleTimeString()}` : ""} `;
  let body: ReactNode;
  // Only blank the pane for an error when there's nothing to show; on a transient
  // poll failure the hook keeps the last-good rows. Servers has no header badge,
  // so when rows survive an error we surface it as a non-destructive warning line.
  if (error && servers.length === 0) {
    body = <text fg={colors.stopped}>{error}</text>;
  } else if (loading && servers.length === 0) {
    body = <text fg={colors.dim}>Loading…</text>;
  } else if (servers.length === 0) {
    body = <text fg={colors.dim}>No servers on this instance.</text>;
  } else {
    const rows = Math.max(1, viewportHeight);
    body = (
      <box flexDirection="column">
        {error ? <text fg={colors.stopped}>{`⚠ ${error}`}</text> : null}
        <text fg={colors.dim}>{"  " + pad("NAME", NAME_WIDTH) + pad("IP", IP_WIDTH) + "STATUS"}</text>
        {servers.slice(0, rows).map((s, i) => {
          const selected = i === selectedIndex;
          const tags = [s.isCoolifyHost ? "host" : null, s.buildServer ? "build" : null].filter(Boolean).join(" ");
          const label = (selected ? "▸ " : "  ") + pad(s.name, NAME_WIDTH) + pad(s.ip, IP_WIDTH);
          return (
            <box key={s.uuid || s.name} flexDirection="row" backgroundColor={selected ? colors.selectedBg : undefined}>
              <text fg={selected ? colors.selectedFg : colors.text}>{label}</text>
              <text fg={healthColor(s)}>●</text>
              <text fg={selected ? colors.selectedFg : colors.dim}>{" " + healthLabel(s) + (tags ? "  " + tags : "")}</text>
            </box>
          );
        })}
      </box>
    );
  }

  return (
    <box
      title={title}
      border
      borderColor={colors.accent}
      flexGrow={1}
      flexDirection="column"
      paddingLeft={1}
      paddingRight={1}
    >
      {body}
    </box>
  );
}
