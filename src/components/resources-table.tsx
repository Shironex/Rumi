import type { ReactNode } from "react";
import { type CoolifyResource, shortKind } from "../coolify/types.ts";
import { colors } from "../theme.ts";
import { StatusDot } from "./status-dot.tsx";

interface Props {
  /** Already-filtered rows to render. */
  resources: CoolifyResource[];
  /** Unfiltered total, for the "shown/total" title. */
  total: number;
  filter: string;
  selectedIndex: number;
  focused: boolean;
  viewportHeight: number;
  loading: boolean;
  error: string | null;
  /** Current spinner frame, rendered on transitioning rows. */
  spinner?: string;
}

const NAME_WIDTH = 26;
const KIND_WIDTH = 5;

function pad(value: string, width: number): string {
  if (value.length > width) return value.slice(0, width - 1) + "…";
  return value.padEnd(width);
}

/** Slice the list to a window that always keeps the selected row visible. */
function windowFor(total: number, selected: number, rows: number): { start: number; end: number } {
  const start = Math.min(
    Math.max(0, selected - Math.floor(rows / 2)),
    Math.max(0, total - rows),
  );
  return { start, end: start + rows };
}

export function ResourcesTable({ resources, total, filter, selectedIndex, focused, viewportHeight, loading, error, spinner }: Props) {
  const borderColor = focused ? colors.accent : colors.border;
  const title = filter
    ? ` resources (${resources.length}/${total})  /${filter} `
    : ` resources (${total}) `;

  let body: ReactNode;
  if (error) {
    body = <text fg={colors.stopped}>{error}</text>;
  } else if (loading && total === 0) {
    body = <text fg={colors.dim}>Loading…</text>;
  } else if (resources.length === 0) {
    body = <text fg={colors.dim}>{filter ? `No matches for "${filter}".` : "No resources on this instance."}</text>;
  } else {
    const rows = Math.max(1, viewportHeight);
    const { start, end } = windowFor(resources.length, selectedIndex, rows);
    body = (
      <box flexDirection="column">
        <text fg={colors.dim}>{"  " + pad("NAME", NAME_WIDTH) + pad("TYPE", KIND_WIDTH) + "STATUS"}</text>
        {resources.slice(start, end).map((r, i) => {
          const selected = start + i === selectedIndex;
          const label = (selected ? "▸ " : "  ") + pad(r.name, NAME_WIDTH) + pad(shortKind(r.kind), KIND_WIDTH);
          return (
            <box
              key={r.uuid || r.name}
              flexDirection="row"
              backgroundColor={selected ? colors.selectedBg : undefined}
            >
              <text fg={selected ? colors.selectedFg : colors.text}>{label}</text>
              <StatusDot state={r.state} spinner={spinner} />
              <text fg={selected ? colors.selectedFg : colors.dim}>{" " + r.status}</text>
            </box>
          );
        })}
      </box>
    );
  }

  return (
    <box title={title} border borderColor={borderColor} flexGrow={1} flexDirection="column" paddingLeft={1} paddingRight={1}>
      {body}
    </box>
  );
}
