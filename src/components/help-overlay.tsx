import { TextAttributes } from "@opentui/core";
import { HELP_SECTIONS } from "../keymap.ts";
import { colors } from "../theme.ts";

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
          rumi · keys
        </text>
        <text> </text>
        {HELP_SECTIONS.map((section) => (
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
