import { TextAttributes } from "@opentui/core";
import { colors } from "../theme.ts";

interface Props {
  /** Imperative verb, e.g. "Restart" / "Stop" / "Deploy". */
  verb: string;
  /** Resource the action targets. */
  target: string;
  busy: boolean;
  error: string | null;
}

/** Centered y/n overlay gating every state-changing action. */
export function ConfirmModal({ verb, target, busy, error }: Props) {
  const borderColor = error ? colors.stopped : colors.transitioning;

  let footer: { text: string; fg: string };
  if (error) footer = { text: error, fg: colors.stopped };
  else if (busy) footer = { text: `${verb.toLowerCase()}ing…`, fg: colors.transitioning };
  else footer = { text: "y confirm · esc / n cancel", fg: colors.dim };

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
        borderColor={borderColor}
        backgroundColor={colors.modalBg}
        flexDirection="column"
        width={50}
        paddingLeft={2}
        paddingRight={2}
        paddingTop={1}
        paddingBottom={1}
      >
        <text fg={colors.text} attributes={TextAttributes.BOLD}>
          {`${verb} this resource?`}
        </text>
        <text fg={colors.accent}>{target}</text>
        <text> </text>
        <text fg={footer.fg}>{footer.text}</text>
      </box>
    </box>
  );
}
