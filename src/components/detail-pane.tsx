import { TextAttributes } from "@opentui/core";
import { memo } from "react";
import type { CoolifyResource } from "../coolify/types.ts";
import { colors, stateColor } from "../theme.ts";

const WIDTH = 46;
const VALUE_MAX = 32;

function truncate(value: string, max: number): string {
  return value.length > max ? value.slice(0, max - 1) + "…" : value;
}

function formatTime(value?: string): string | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString();
}

function Row({ label, value, valueColor }: { label: string; value?: string; valueColor?: string }) {
  if (!value) return null;
  return (
    <box flexDirection="row">
      <text fg={colors.dim}>{label.padEnd(9)}</text>
      <text fg={valueColor ?? colors.text}>{truncate(value, VALUE_MAX)}</text>
    </box>
  );
}

// Memoized: `resource` is a stable reference across spinner ticks (the filtered
// list only recomputes on data/filter change), so the detail pane skips them.
export const DetailPane = memo(function DetailPane({ resource, focused }: { resource?: CoolifyResource; focused: boolean }) {
  const branch = resource?.meta.gitBranch
    ? resource.meta.gitBranch +
      (resource.meta.gitCommitSha ? ` @ ${resource.meta.gitCommitSha.slice(0, 7)}` : "")
    : undefined;

  return (
    <box
      title=" detail "
      border
      borderColor={focused ? colors.accent : colors.border}
      width={WIDTH}
      flexShrink={0}
      flexDirection="column"
      paddingLeft={1}
      paddingRight={1}
    >
      {!resource ? (
        <text fg={colors.dim}>No selection.</text>
      ) : (
        <box flexDirection="column">
          <text fg={colors.accent} attributes={TextAttributes.BOLD}>
            {resource.name}
          </text>
          <text fg={colors.dim}>{resource.rawType}</text>
          <text> </text>
          <Row label="status" value={resource.status} valueColor={stateColor(resource.state)} />
          <Row label="domains" value={resource.meta.fqdn} />
          <Row label="branch" value={branch} />
          <Row label="repo" value={resource.meta.gitRepository} />
          <Row label="build" value={resource.meta.buildPack} />
          <Row label="server" value={resource.meta.serverStatus} />
          <Row label="online" value={formatTime(resource.meta.lastOnlineAt)} />
          <Row label="updated" value={formatTime(resource.meta.updatedAt)} />
          <Row label="uuid" value={resource.uuid} />
        </box>
      )}
    </box>
  );
});
