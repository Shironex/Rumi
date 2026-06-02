import { SPLASH_ART } from "../assets/splash-art.ts";
import { colors } from "../theme.ts";

interface Props {
  contextName?: string;
  error: string | null;
  /** Current spinner frame for the status line. */
  spinner: string;
}

/** Full-screen ASCII splash shown while the first resource fetch runs. */
export function Splash({ contextName, error, spinner }: Props) {
  // On failure show the resolved, actionable error (unreachable host, bad token,
  // blocked API) and drop the spinner — it would otherwise keep "trying" forever
  // since the first fetch never lands.
  const status = error ?? `connecting to ${contextName ?? "Coolify"}…`;

  return (
    <box flexGrow={1} flexDirection="column" alignItems="center" justifyContent="center">
      {/* Art rows live in their own left-aligned box so the picture holds together
          while the box itself is centered as a single unit. */}
      <box flexDirection="column">
        {SPLASH_ART.map((line, i) => (
          <text key={i} fg={colors.dim}>
            {line}
          </text>
        ))}
      </box>

      <text> </text>
      {/* block font is 6 rows; reserve them so the tagline can't overlap the baseline. */}
      <box height={6} flexShrink={0} alignItems="center">
        <ascii-font text="rumi" font="block" color={[colors.accent, "#ff79c6"]} />
      </box>
      <text> </text>
      <text fg={colors.dim}>k9s-style control for Coolify</text>
      <text> </text>
      <text fg={error ? colors.stopped : colors.accent}>{error ? status : `${spinner}  ${status}`}</text>
      <text fg={colors.dim}>{error ? "press any key to continue" : "press any key to skip"}</text>
    </box>
  );
}
