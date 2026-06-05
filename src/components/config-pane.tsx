import type { ReactNode } from "react";
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
  /** Cursor into envs for the edit/delete affordances; -1 when nothing is selectable. */
  selectedIndex?: number;
}

const MASK = "••••••••";
const ENV_WINDOW = 9;

function truncate(text: string, width: number): string {
  return text.length > width ? text.slice(0, Math.max(1, width - 1)) + "…" : text;
}

/** Slice the env list to a window that always keeps the selected row visible. */
function windowFor(total: number, selected: number, rows: number): { start: number; end: number } {
  if (total <= rows) return { start: 0, end: total };
  const start = Math.min(Math.max(0, selected - Math.floor(rows / 2)), total - rows);
  return { start, end: start + rows };
}

export function ConfigPane({
  name,
  config,
  envs,
  valuesAvailable,
  reveal,
  loading,
  error,
  supported,
  height,
  maxWidth,
  focused,
  selectedIndex = -1,
}: Props) {
  let body: ReactNode;

  if (!supported) {
    body = <text fg={colors.dim}>Config inspection covers applications and services.</text>;
  } else if (error) {
    body = <text fg={colors.stopped}>{error}</text>;
  } else if (loading && config.length === 0 && envs.length === 0) {
    body = <text fg={colors.dim}>Loading config…</text>;
  } else {
    // Width of the key text itself; the 2-char selection marker sits outside it.
    const keyCol = Math.min(26, Math.max(8, ...envs.map((e) => e.key.length), 8));
    const valCol = Math.max(8, Math.min(44, maxWidth - keyCol - 26));
    // A token without read:sensitive returns env keys but no values. Call that out
    // in a warning colour — it's why `v` reveals nothing, not a rumi bug.
    const scopeHidden = envs.length > 0 && !valuesAvailable;
    const revealHint = envs.length === 0 || !valuesAvailable ? "" : reveal ? "· v hide values" : "· v reveal values";
    const { start, end } = windowFor(envs.length, selectedIndex < 0 ? 0 : selectedIndex, ENV_WINDOW);
    const more = envs.length - (end - start);

    body = (
      <box flexDirection="column" height={Math.max(1, height - 2)}>
        <box flexDirection="row">
          <text fg={colors.dim}>{`environment (${envs.length}) `}</text>
          {scopeHidden ? (
            <text fg={colors.degraded}>· values hidden (token lacks read:sensitive)</text>
          ) : revealHint ? (
            <text fg={colors.dim}>{revealHint}</text>
          ) : null}
          {more > 0 ? <text fg={colors.dim}>{`  ·  ${start + 1}-${end} of ${envs.length}`}</text> : null}
        </box>
        {envs.length === 0 ? (
          <text fg={colors.dim}>{"  (none)"}</text>
        ) : (
          envs.slice(start, end).map((env, i) => (
            // Key on uuid, not env.key: an app with preview deployments has two
            // rows per key (production + preview, same key, different uuid), so
            // keying on env.key would collide and drop/merge rows.
            <EnvRow
              key={env.uuid || `${env.key}-${start + i}`}
              env={env}
              reveal={reveal}
              keyCol={keyCol}
              valCol={valCol}
              selected={start + i === selectedIndex}
            />
          ))
        )}

        <text> </text>
        <text fg={colors.dim}>configuration</text>
        {config.length === 0 ? (
          <text fg={colors.dim}>{"  (no config fields)"}</text>
        ) : (
          config.map((field) => <ConfigRow key={field.label} field={field} maxWidth={maxWidth} />)
        )}
      </box>
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

function EnvRow({
  env,
  reveal,
  keyCol,
  valCol,
  selected,
}: {
  env: EnvVar;
  reveal: boolean;
  keyCol: number;
  valCol: number;
  selected: boolean;
}) {
  const hasValue = env.value !== undefined;
  const shown = !hasValue ? "(hidden)" : reveal ? truncate(env.value ?? "", valCol) : MASK;
  const marker = selected ? "▸ " : "  ";
  const keyColor = selected ? colors.selectedFg : env.managed ? colors.dim : colors.accent;
  const valueColor = selected ? colors.selectedFg : !hasValue ? colors.dim : reveal ? colors.text : colors.dim;
  const tags = envScopeTags(env).join(" ");
  return (
    <box flexDirection="row" backgroundColor={selected ? colors.selectedBg : undefined}>
      <text fg={keyColor}>{marker + truncate(env.key, keyCol).padEnd(keyCol + 1)}</text>
      <text fg={valueColor}>{shown.padEnd(valCol)}</text>
      <text fg={selected ? colors.selectedFg : colors.dim}>{tags}</text>
    </box>
  );
}
