import { colors } from "../theme.ts";

type View = "resources" | "servers";

interface Props {
  filterMode: boolean;
  filter: string;
  logsOpen: boolean;
  view: View;
}

export function FooterBar({ filterMode, filter, logsOpen, view }: Props) {
  if (filterMode) {
    return (
      <box flexDirection="row">
        <text fg={colors.accent}>{`/${filter}▌`}</text>
        <text fg={colors.dim}>{"   enter apply · esc clear"}</text>
      </box>
    );
  }

  let hints: string;
  if (logsOpen) {
    hints = "tailing   ↑↓ scroll   esc close   q quit";
  } else if (view === "servers") {
    hints = "↑↓/jk move   R refresh   c context   tab resources   q quit";
  } else {
    hints = "↑↓/jk move   / filter   l logs   L deploy   s/r/d start·restart·deploy   R refresh   c context   tab servers   q quit";
  }
  return <text fg={colors.dim}>{hints}</text>;
}
