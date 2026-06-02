import type { ScrollBoxRenderable } from "@opentui/core";
import type { ReactNode, Ref } from "react";
import type { CoolifyResource, ResourceKind } from "../coolify/types.ts";
import { colors } from "../theme.ts";

interface Props {
  resource: CoolifyResource;
  lines: string[];
  loading: boolean;
  error: string | null;
  supported: boolean;
  height: number;
  maxWidth: number;
  focused: boolean;
  /** Lets the app scroll the tail programmatically (arrows / wheel). */
  scrollRef?: Ref<ScrollBoxRenderable>;
}

function lineColor(line: string): string {
  if (/\b(error|fatal|exception)\b/i.test(line)) return colors.stopped;
  if (/\bwarn(ing)?\b/i.test(line)) return colors.transitioning;
  if (/\bdebug\b/i.test(line)) return colors.dim;
  return colors.text;
}

function unsupportedMessage(kind: ResourceKind): string {
  const noun = kind === "database" ? "databases" : kind === "service" ? "services" : "this resource type";
  return `Coolify's API doesn't expose logs for ${noun} (applications only).`;
}

export function LogsPane({ resource, lines, loading, error, supported, height, maxWidth, focused, scrollRef }: Props) {
  let body: ReactNode;
  const hasContent = lines.some((l) => l.trim() !== "");
  if (!supported) {
    body = <text fg={colors.dim}>{unsupportedMessage(resource.kind)}</text>;
  } else if (error) {
    body = <text fg={colors.stopped}>{error}</text>;
  } else if (loading && !hasContent) {
    // Same emptiness test as the no-output branch below, so a future streaming
    // tail (loading=true with partial lines) can't fall through to "No output".
    body = <text fg={colors.dim}>Tailing…</text>;
  } else if (!hasContent) {
    // Coolify returns "" for an app that simply hasn't logged anything; show that
    // explicitly rather than an empty box that reads as a broken pane.
    body = <text fg={colors.dim}>No log output yet.</text>;
  } else {
    body = (
      <scrollbox ref={scrollRef} stickyScroll stickyStart="bottom" height={Math.max(1, height - 2)}>
        {lines.map((line, i) => {
          const shown = line.length > maxWidth ? line.slice(0, maxWidth - 1) + "…" : line || " ";
          return (
            <text key={i} fg={lineColor(line)}>
              {shown}
            </text>
          );
        })}
      </scrollbox>
    );
  }

  return (
    <box
      title={` logs · ${resource.name} `}
      border
      borderColor={focused ? colors.accent : colors.border}
      height={height}
      flexShrink={0}
      flexDirection="column"
      paddingLeft={1}
      paddingRight={1}
    >
      {body}
    </box>
  );
}
