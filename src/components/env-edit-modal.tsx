import { TextAttributes } from "@opentui/core";
import { colors } from "../theme.ts";

interface Props {
  mode: "edit" | "add";
  /** The key being edited (edit mode). */
  envKey: string;
  /** Current input buffer: the new value (edit) or a `KEY=value` line (add). */
  draft: string;
  busy: boolean;
  error: string | null;
  /** Edit mode only: the current value couldn't be read (no read:sensitive / shown-once). */
  valueHidden: boolean;
}

/**
 * Centered editor for an env var. Reuses the project's manual-input pattern (the
 * App feeds keystrokes into `draft`) rather than OpenTUI's input component, to
 * match the `/` filter. The value is shown in plaintext — you're editing it.
 */
export function EnvEditModal({ mode, envKey, draft, busy, error, valueHidden }: Props) {
  const title = mode === "add" ? "add env var" : `edit ${envKey}`;
  const prompt = mode === "add" ? "KEY=value" : "value";

  let footer: { text: string; fg: string };
  if (error) footer = { text: error, fg: colors.stopped };
  else if (busy) footer = { text: "saving…", fg: colors.transitioning };
  else footer = { text: "↵ save · esc cancel · applies on next deploy", fg: colors.dim };

  return (
    <box
      position="absolute"
      top={0}
      left={0}
      right={0}
      bottom={0}
      alignItems="center"
      justifyContent="center"
      zIndex={120}
    >
      <box
        border
        borderStyle="double"
        borderColor={error ? colors.stopped : colors.accent}
        backgroundColor={colors.modalBg}
        flexDirection="column"
        width={60}
        paddingLeft={2}
        paddingRight={2}
        paddingTop={1}
        paddingBottom={1}
      >
        <text fg={colors.text} attributes={TextAttributes.BOLD}>
          {title}
        </text>
        {mode === "edit" && valueHidden ? (
          <text fg={colors.degraded}>current value is hidden — type a new one</text>
        ) : null}
        <text> </text>
        <box flexDirection="row">
          <text fg={colors.dim}>{`${prompt}  `}</text>
          <text fg={colors.text}>{`${draft}▌`}</text>
        </box>
        <text> </text>
        <text fg={footer.fg}>{footer.text}</text>
      </box>
    </box>
  );
}
