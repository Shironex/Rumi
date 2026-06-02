import { TextAttributes } from "@opentui/core";
import { COOLIFY_CONFIG_PATH } from "../config.ts";
import { colors } from "../theme.ts";

const EXAMPLE = '{ "instances": [{ "name": "prod", "fqdn": "https://...", "token": "...", "default": true }] }';

interface Props {
  /** When set, a config file exists but couldn't be read — show the reason, not the first-run copy. */
  configError?: string | null;
}

/** Empty state shown when no Coolify contexts are configured (or the config is unreadable). */
export function Onboarding({ configError }: Props = {}) {
  if (configError) {
    return (
      <box flexGrow={1} flexDirection="column" alignItems="center" justifyContent="center">
        <text fg={colors.stopped} attributes={TextAttributes.BOLD}>
          Couldn't read your Coolify config
        </text>
        <text> </text>
        <text fg={colors.text}>{COOLIFY_CONFIG_PATH}</text>
        <text> </text>
        <text fg={colors.dim}>{configError}</text>
        <text> </text>
        <text fg={colors.dim}>Fix the file (it must be valid JSON) or run: coolify login · q to quit</text>
      </box>
    );
  }
  return (
    <box flexGrow={1} flexDirection="column" alignItems="center" justifyContent="center">
      <text fg={colors.accent} attributes={TextAttributes.BOLD}>
        Welcome to rumi
      </text>
      <text> </text>
      <text fg={colors.text}>No Coolify instance is configured yet.</text>
      <text fg={colors.dim}>Add one to the shared Coolify CLI config:</text>
      <text> </text>
      <text fg={colors.text}>{COOLIFY_CONFIG_PATH}</text>
      <text> </text>
      <text fg={colors.dim}>{EXAMPLE}</text>
      <text> </text>
      <text fg={colors.dim}>or run: coolify login · q to quit</text>
    </box>
  );
}
