import { TextAttributes } from "@opentui/core";
import type { CoolifyContext } from "../config.ts";
import { colors } from "../theme.ts";

interface Props {
  contexts: CoolifyContext[];
  activeIndex: number;
  focused: boolean;
}

export function ContextsPane({ contexts, activeIndex, focused }: Props) {
  return (
    <box
      title=" contexts "
      border
      borderColor={focused ? colors.accent : colors.border}
      flexDirection="column"
      width={22}
      flexShrink={0}
      paddingLeft={1}
      paddingRight={1}
    >
      {contexts.map((ctx, i) => {
        const active = i === activeIndex;
        return (
          <text
            key={ctx.name}
            fg={active ? colors.accent : colors.dim}
            attributes={active ? TextAttributes.BOLD : undefined}
          >
            {(active ? "▸ " : "  ") + ctx.name}
          </text>
        );
      })}
    </box>
  );
}
