import { TextAttributes } from "@opentui/core";
import { COOLIFY_CONFIG_PATH } from "../config.ts";
import { colors } from "../theme.ts";

const EXAMPLE = '{ "instances": [{ "name": "prod", "fqdn": "https://...", "token": "...", "default": true }] }';

/** Empty state shown when no Coolify contexts are configured. */
export function Onboarding() {
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
      <text fg={colors.dim}>or run:  coolify login    ·    q to quit</text>
    </box>
  );
}
