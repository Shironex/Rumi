import type { ScrollBoxRenderable } from "@opentui/core";
import type { ReactNode, Ref } from "react";
import { type ConfigField, type EnvVar, envScopeTags } from "../coolify/types.ts";
import { colors } from "../theme.ts";

interface Props {
  name: string;
  config: ConfigField[];
  envs: EnvVar[];
  /** Whether the token returned env values (drives the reveal affordance + hint). */
  valuesAvailable: boolean;
  /** When true, show real env values instead of the mask. */
  reveal: boolean;
  loading: boolean;
  error: string | null;
  /** False when the resource kind has no config/env endpoint. */
  supported: boolean;
  height: number;
  maxWidth: number;
  focused: boolean;
  scrollRef?: Ref<ScrollBoxRenderable>;
}

const MASK = "••••••••";

function truncate(text: string, width: number): string {
  return text.length > width ? text.slice(0, Math.max(1, width - 1)) + "…" : text;
}

export function ConfigPane({ name, config, envs, valuesAvailable, reveal, loading, error, supported, height, maxWidth, focused, scrollRef }: Props) {
  let body: ReactNode;

  if (!supported) {
    body = <text fg={colors.dim}>Config inspection covers applications and services.</text>;
  } else if (error) {
    body = <text fg={colors.stopped}>{error}</text>;
  } else if (loading && config.length === 0 && envs.length === 0) {
    body = <text fg={colors.dim}>Loading config…</text>;
  } else {
    const keyCol = Math.min(28, Math.max(10, ...envs.map((e) => e.key.length + 2), 10));
    const valCol = Math.max(8, Math.min(44, maxWidth - keyCol - 24));
    const envNote =
      envs.length === 0
        ? ""
        : valuesAvailable
          ? reveal
            ? "· v hide values"
            : "· v reveal values"
          : "· values hidden (token lacks read:sensitive)";

    body = (
      <scrollbox ref={scrollRef} stickyScroll={false} height={Math.max(1, height - 2)}>
        <text fg={colors.dim}>{`environment (${envs.length}) ${envNote}`}</text>
        {envs.length === 0 ? (
          <text fg={colors.dim}>{"  (none)"}</text>
        ) : (
          envs.map((env) => <EnvRow key={env.key} env={env} reveal={reveal} keyCol={keyCol} valCol={valCol} />)
        )}

        <text> </text>
        <text fg={colors.dim}>configuration</text>
        {config.length === 0 ? (
          <text fg={colors.dim}>{"  (no config fields)"}</text>
        ) : (
          config.map((field) => <ConfigRow key={field.label} field={field} maxWidth={maxWidth} />)
        )}
      </scrollbox>
    );
  }

  return (
    <box
      title={` config · ${name} `}
      border
      borderColor={focused ? colors.accent : colors.border}
      height={height}
      flexShrink={0}
      flexDirection="column"
      paddingLeft={1}
      paddingRight={1}
    >
      {body}
    </box>
  );
}

function ConfigRow({ field, maxWidth }: { field: ConfigField; maxWidth: number }) {
  return (
    <box flexDirection="row">
      <text fg={colors.dim}>{field.label.padEnd(16)}</text>
      <text fg={colors.text}>{truncate(field.value, Math.max(8, maxWidth - 18))}</text>
    </box>
  );
}

function EnvRow({ env, reveal, keyCol, valCol }: { env: EnvVar; reveal: boolean; keyCol: number; valCol: number }) {
  const hasValue = env.value !== undefined;
  const shown = !hasValue ? "(hidden)" : reveal ? truncate(env.value ?? "", valCol) : MASK;
  const valueColor = !hasValue ? colors.dim : reveal ? colors.text : colors.dim;
  const tags = envScopeTags(env).join(" ");
  return (
    <box flexDirection="row">
      <text fg={env.managed ? colors.dim : colors.accent}>{truncate(env.key, keyCol - 1).padEnd(keyCol)}</text>
      <text fg={valueColor}>{shown.padEnd(valCol)}</text>
      <text fg={colors.dim}>{tags}</text>
    </box>
  );
}
