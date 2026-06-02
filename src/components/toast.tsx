import { colors } from "../theme.ts";
import type { ToastState } from "../hooks/use-toast.ts";

/** Transient top-right confirmation, e.g. after a lifecycle action. */
export function Toast({ text, tone }: ToastState) {
  const color = tone === "warn" ? colors.transitioning : colors.running;
  return (
    <box position="absolute" top={1} right={2} zIndex={150}>
      <box
        border
        borderStyle="rounded"
        borderColor={color}
        backgroundColor={colors.modalBg}
        paddingLeft={1}
        paddingRight={1}
      >
        <text fg={color}>{text}</text>
      </box>
    </box>
  );
}
