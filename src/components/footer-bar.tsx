import { memo } from "react";
import { colors } from "../theme.ts";

type View = "resources" | "servers";
type OverlayKind = "runtime" | "deploy" | "config" | null;

interface Props {
  filterMode: boolean;
  filter: string;
  overlayKind: OverlayKind;
  view: View;
}

// Memoized: all props are primitives, so the footer skips the 90ms spinner tick.
export const FooterBar = memo(function FooterBar({ filterMode, filter, overlayKind, view }: Props) {
  if (filterMode) {
    return (
      <box flexDirection="row">
        <text fg={colors.accent}>{`/${filter}▌`}</text>
        <text fg={colors.dim}>{"   enter apply · esc clear"}</text>
      </box>
    );
  }

  let hints: string;
  if (overlayKind === "config") {
    hints = "↑↓ PgUp/PgDn scroll   v values   e/esc close   q quit";
  } else if (overlayKind) {
    hints = "tailing   ↑↓ PgUp/PgDn scroll   esc close   q quit";
  } else if (view === "servers") {
    hints = "↑↓/jk move   R refresh   c context   tab resources   ? help   q quit";
  } else {
    hints =
      "↑↓/jk move   / filter   l logs   L deploy   e config   s/r/d act   R refresh   c context   tab servers   ? help   q quit";
  }
  return <text fg={colors.dim}>{hints}</text>;
});
