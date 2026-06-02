import { TextAttributes } from "@opentui/core";
import type { CoolifyContext } from "../config.ts";
import { colors } from "../theme.ts";

interface Props {
  contexts: CoolifyContext[];
  /** Currently active context. */
  activeIndex: number;
  /** Highlighted row inside the modal. */
  cursor: number;
}

/** Overlay context switcher: arrows move the cursor, enter selects. */
export function ContextModal({ contexts, activeIndex, cursor }: Props) {
  return (
    <box
      position="absolute"
      top={0}
      left={0}
      right={0}
      bottom={0}
      alignItems="center"
      justifyContent="center"
      zIndex={100}
    >
      <box
        border
        borderStyle="double"
        borderColor={colors.accent}
        backgroundColor={colors.modalBg}
        flexDirection="column"
        width={44}
        paddingLeft={2}
        paddingRight={2}
        paddingTop={1}
        paddingBottom={1}
      >
        <text fg={colors.text} attributes={TextAttributes.BOLD}>
          switch context
        </text>
        <text> </text>
        {contexts.map((ctx, i) => {
          const highlighted = i === cursor;
          const isActive = i === activeIndex;
          const fg = highlighted ? colors.selectedFg : isActive ? colors.accent : colors.dim;
          return (
            <box key={ctx.name} flexDirection="row" backgroundColor={highlighted ? colors.selectedBg : undefined}>
              <text fg={fg}>{(isActive ? "● " : "  ") + ctx.name}</text>
            </box>
          );
        })}
        <text> </text>
        <text fg={colors.dim}>↑↓ move · enter select · esc close</text>
      </box>
    </box>
  );
}
