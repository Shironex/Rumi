import type { ScrollBoxRenderable } from "@opentui/core";
import type { ReactNode, Ref } from "react";
import { type Deployment, type DeployLogType, isTerminalStatus } from "../coolify/types.ts";
import { colors } from "../theme.ts";

interface Props {
  name: string;
  deployment: Deployment | null;
  loading: boolean;
  error: string | null;
  /** False when the resource kind has no deployment endpoint (non-applications). */
  supported: boolean;
  height: number;
  maxWidth: number;
  focused: boolean;
  scrollRef?: Ref<ScrollBoxRenderable>;
  /** Current spinner frame, shown while the build is still running. */
  spinner?: string;
}

function statusColor(status: string): string {
  const s = status.toLowerCase();
  if (s === "finished") return colors.running;
  if (s === "failed" || s === "error" || s.includes("cancel")) return colors.stopped;
  return colors.transitioning; // queued / in_progress / running
}

function lineColor(type: DeployLogType): string {
  if (type === "stderr") return colors.stopped;
  if (type === "command") return colors.accent;
  return colors.text;
}

export function DeployLogsPane({ name, deployment, loading, error, supported, height, maxWidth, focused, scrollRef, spinner }: Props) {
  let body: ReactNode;
  if (!supported) {
    body = <text fg={colors.dim}>Deploy logs are available for applications only.</text>;
  } else if (error) {
    body = <text fg={colors.stopped}>{error}</text>;
  } else if (!deployment || (loading && deployment.lines.length === 0)) {
    body = <text fg={colors.dim}>Waiting for the build…</text>;
  } else {
    const visible = deployment.lines.filter((l) => !l.hidden);
    if (visible.length === 0) {
      body = (
        <text fg={colors.dim}>
          {isTerminalStatus(deployment.status) ? "No build output for this deployment." : "Building…"}
        </text>
      );
    } else {
      body = (
        <scrollbox ref={scrollRef} stickyScroll stickyStart="bottom" height={Math.max(1, height - 3)}>
          {visible.map((line, i) => {
            const raw = (line.type === "command" ? "$ " : "") + line.text;
            const shown = raw.length > maxWidth ? raw.slice(0, maxWidth - 1) + "…" : raw || " ";
            return (
              <text key={i} fg={lineColor(line.type)}>
                {shown}
              </text>
            );
          })}
        </scrollbox>
      );
    }
  }

  return (
    <box
      title={` deploy · ${name} `}
      border
      borderColor={focused ? colors.accent : colors.border}
      height={height}
      flexShrink={0}
      flexDirection="column"
      paddingLeft={1}
      paddingRight={1}
    >
      {supported && deployment ? (
        <text fg={statusColor(deployment.status)}>
          {(!isTerminalStatus(deployment.status) && spinner ? `${spinner} ` : "") +
            deployment.status +
            (deployment.commit ? `  ${deployment.commit.slice(0, 7)}` : "") +
            (deployment.commitMessage ? `  ${deployment.commitMessage}` : "")}
        </text>
      ) : null}
      {body}
    </box>
  );
}
