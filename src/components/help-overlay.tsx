import { TextAttributes } from "@opentui/core";
import { colors } from "../theme.ts";

const SECTIONS: ReadonlyArray<{ title: string; keys: ReadonlyArray<readonly [string, string]> }> = [
  {
    title: "navigate",
    keys: [
      ["↑ ↓ / j k", "move selection"],
      ["tab", "resources / servers"],
      ["/", "filter resources"],
      ["c", "switch context"],
    ],
  },
  {
    title: "act on selected",
    keys: [
      ["s", "start / stop"],
      ["r", "restart"],
      ["d", "deploy (apps, services)"],
      ["R", "refresh now"],
    ],
  },
  {
    title: "logs",
    keys: [
      ["l", "runtime logs"],
      ["L", "deploy / build logs"],
      ["↑ ↓", "scroll while open"],
      ["esc", "close logs"],
    ],
  },
  {
    title: "general",
    keys: [
      ["?", "this help"],
      ["q / ^C", "quit"],
    ],
  },
];

export function HelpOverlay() {
  return (
    <box
      position="absolute"
      top={0}
      left={0}
      right={0}
      bottom={0}
      alignItems="center"
      justifyContent="center"
      zIndex={200}
    >
      <box
        border
        borderStyle="rounded"
        borderColor={colors.accent}
        backgroundColor={colors.modalBg}
        flexDirection="column"
        width={46}
        paddingLeft={2}
        paddingRight={2}
        paddingTop={1}
        paddingBottom={1}
      >
        <text fg={colors.accent} attributes={TextAttributes.BOLD}>
          kanrisha · keys
        </text>
        <text> </text>
        {SECTIONS.map((section) => (
          <box key={section.title} flexDirection="column">
            <text fg={colors.dim}>{section.title}</text>
            {section.keys.map(([key, desc]) => (
              <box key={key} flexDirection="row">
                <text fg={colors.text}>{key.padEnd(12)}</text>
                <text fg={colors.dim}>{desc}</text>
              </box>
            ))}
            <text> </text>
          </box>
        ))}
        <text fg={colors.dim}>esc / ? to close</text>
      </box>
    </box>
  );
}
