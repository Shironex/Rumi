import { colors } from "../theme.ts";

type Pane = "contexts" | "resources";

interface Props {
  filterMode: boolean;
  filter: string;
  focus: Pane;
  logsOpen: boolean;
}

export function FooterBar({ filterMode, filter, focus, logsOpen }: Props) {
  if (filterMode) {
    return (
      <box flexDirection="row">
        <text fg={colors.accent}>{`/${filter}▌`}</text>
        <text fg={colors.dim}>{"   enter apply · esc clear"}</text>
      </box>
    );
  }
  const hints = logsOpen
    ? "tailing logs   l/esc close   q quit"
    : `↑↓/jk move   / filter   l logs   s/r/d start·restart·deploy   R refresh   tab [${focus}]   q quit`;
  return <text fg={colors.dim}>{hints}</text>;
}
