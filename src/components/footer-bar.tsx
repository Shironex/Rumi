import { memo } from "react";
import { footerHints, type OverlayKind, type View } from "../keymap.ts";
import { colors } from "../theme.ts";

interface Props {
  filterMode: boolean;
  filter: string;
  overlayKind: OverlayKind | null;
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
  return <text fg={colors.dim}>{footerHints(overlayKind, view)}</text>;
});
