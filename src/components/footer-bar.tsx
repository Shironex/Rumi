import { colors } from "../theme.ts";

interface Props {
  filterMode: boolean;
  filter: string;
  logsOpen: boolean;
}

export function FooterBar({ filterMode, filter, logsOpen }: Props) {
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
    : "↑↓/jk move   / filter   l logs   s/r/d start·restart·deploy   R refresh   c context   q quit";
  return <text fg={colors.dim}>{hints}</text>;
}
