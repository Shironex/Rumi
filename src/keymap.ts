import type { KeyEvent, ScrollBoxRenderable } from "@opentui/core";
import type { Dispatch, RefObject, SetStateAction } from "react";
import { canAct, canDeploy, toggleVerb } from "./coolify/actions.ts";
import type { CoolifyResource, EnvVar } from "./coolify/types.ts";
import type { useActions } from "./hooks/use-actions.ts";
import type { useContexts } from "./hooks/use-contexts.ts";
import type { useEnvActions } from "./hooks/use-env-actions.ts";
import type { useResourceList } from "./hooks/use-resource-list.ts";
import type { useServers } from "./hooks/use-servers.ts";
import { clamp, isPrintable } from "./util.ts";

export type View = "resources" | "servers";

export type Overlay =
  | { kind: "runtime"; resource: CoolifyResource }
  | { kind: "deploy"; resource: CoolifyResource; trackUuid?: string }
  | { kind: "config"; resource: CoolifyResource };

export type OverlayKind = Overlay["kind"];

export type EnvEdit = { mode: "edit" | "add"; key: string; draft: string };

/**
 * Everything the keyboard handlers read or call, rebuilt fresh every render in
 * App and handed to dispatchKey. Because useKeyboard wraps its callback in
 * useEffectEvent, the chain always runs against the latest ctx — so handlers
 * must read state through ctx, never capture it, and never be memoized.
 */
export interface KeyContext {
  showSplash: boolean;
  setSplashSkipped: Dispatch<SetStateAction<boolean>>;
  exitApp: () => void;
  list: ReturnType<typeof useResourceList>;
  actions: ReturnType<typeof useActions>;
  servers: ReturnType<typeof useServers>;
  contexts: ReturnType<typeof useContexts>;
  envActions: ReturnType<typeof useEnvActions>;
  view: View;
  setView: Dispatch<SetStateAction<View>>;
  noContexts: boolean;
  contextOpen: boolean;
  setContextOpen: Dispatch<SetStateAction<boolean>>;
  contextCursor: number;
  setContextCursor: Dispatch<SetStateAction<number>>;
  lastContext: number;
  helpOpen: boolean;
  setHelpOpen: Dispatch<SetStateAction<boolean>>;
  overlay: Overlay | null;
  setOverlay: Dispatch<SetStateAction<Overlay | null>>;
  envEdit: EnvEdit | null;
  setEnvEdit: Dispatch<SetStateAction<EnvEdit | null>>;
  pendingEnvDelete: EnvVar | null;
  setPendingEnvDelete: Dispatch<SetStateAction<EnvVar | null>>;
  setRevealEnv: Dispatch<SetStateAction<boolean>>;
  setEnvCursor: Dispatch<SetStateAction<number>>;
  selectedEnv: EnvVar | undefined;
  moveEnvCursor: (delta: number) => void;
  openEnvEdit: (mode: "edit" | "add") => void;
  submitEnvEdit: () => void;
  doEnvDelete: () => void;
  copyEnv: () => void;
  logScrollRef: RefObject<ScrollBoxRenderable | null>;
}

/** Returns true when this handler owned the event — the chain then stops. */
type KeyHandler = (e: KeyEvent, ctx: KeyContext) => boolean;

const isQuit = (e: KeyEvent) => e.name === "q" || (e.ctrl && e.name === "c");
// Shift+L arrives as sequence "L" (capital) or name "l" with shift set.
const wantsDeployLog = (e: KeyEvent) => e.sequence === "L" || (e.name === "l" && e.shift);

// The chain is split into two kinds of handler:
//   • modal handlers (0–5): once their guard is active they swallow EVERY key
//     (return true unconditionally) — unrecognized keys included.
//   • fall-through handlers (6–8): return true only when they match a key, so
//     control passes down the chain (e.g. ?/tab fall through to view, then nav).
// Array order IS the precedence. Adding a binding = touch one handler here.

// 0) splash: any key dismisses it (quit still quits)
const splashKeys: KeyHandler = (e, ctx) => {
  if (!ctx.showSplash) return false;
  if (isQuit(e)) ctx.exitApp();
  else ctx.setSplashSkipped(true);
  return true;
};

// 1) filter input mode swallows everything (including q — it types a literal q)
const filterKeys: KeyHandler = (e, ctx) => {
  if (!ctx.list.filterMode) return false;
  ctx.list.handleFilterKey(e);
  return true;
};

// 2) action confirm modal: y confirms, esc / n cancels (never Enter, too reflexive)
const confirmKeys: KeyHandler = (e, ctx) => {
  if (!ctx.actions.pending) return false;
  if (isQuit(e)) ctx.exitApp();
  if (e.name === "y") ctx.actions.confirm();
  else if (e.name === "escape" || e.name === "n") ctx.actions.cancel();
  return true;
};

// 3) context switcher modal
const contextKeys: KeyHandler = (e, ctx) => {
  if (!ctx.contextOpen) return false;
  if (isQuit(e)) ctx.exitApp();
  if (e.name === "escape" || e.name === "c") ctx.setContextOpen(false);
  else if (e.name === "up" || e.name === "k") ctx.setContextCursor((c) => clamp(c - 1, 0, ctx.lastContext));
  else if (e.name === "down" || e.name === "j") ctx.setContextCursor((c) => clamp(c + 1, 0, ctx.lastContext));
  else if (e.name === "return" || e.name === "enter") {
    ctx.contexts.select(ctx.contextCursor);
    ctx.setContextOpen(false);
  }
  return true;
};

// 4) help overlay: esc / ? dismisses (quit stays live)
const helpKeys: KeyHandler = (e, ctx) => {
  if (!ctx.helpOpen) return false;
  if (isQuit(e)) ctx.exitApp();
  if (e.name === "escape" || e.name === "?" || e.sequence === "?") ctx.setHelpOpen(false);
  return true;
};

// 5) logs / deploy-logs / config overlay (with env edit + delete sub-modes)
const overlayKeys: KeyHandler = (e, ctx) => {
  const { overlay } = ctx;
  if (!overlay) return false;

  // 5a) env edit/add input sub-mode swallows EVERYTHING (incl. q) — it's a text
  // field; must precede the quit check so typing "q" lands in the draft.
  if (overlay.kind === "config" && ctx.envEdit) {
    if (e.name === "escape") {
      ctx.setEnvEdit(null);
      ctx.envActions.clearError();
    } else if (e.name === "return" || e.name === "enter") ctx.submitEnvEdit();
    else if (e.name === "backspace") ctx.setEnvEdit((s) => (s ? { ...s, draft: s.draft.slice(0, -1) } : s));
    else if (isPrintable(e.sequence, e.ctrl, e.meta))
      ctx.setEnvEdit((s) => (s ? { ...s, draft: s.draft + e.sequence } : s));
    return true;
  }

  // 5b) env delete confirm: y deletes, esc/n cancels (Enter never, too reflexive)
  if (overlay.kind === "config" && ctx.pendingEnvDelete) {
    if (isQuit(e)) ctx.exitApp();
    if (ctx.envActions.busy) return true;
    if (e.name === "y") ctx.doEnvDelete();
    else if (e.name === "escape" || e.name === "n") {
      ctx.setPendingEnvDelete(null);
      ctx.envActions.clearError();
    }
    return true;
  }

  if (isQuit(e)) ctx.exitApp();
  if (e.name === "escape") ctx.setOverlay(null);
  else if (overlay.kind === "runtime" && e.name === "l") ctx.setOverlay(null);
  else if (overlay.kind === "deploy" && wantsDeployLog(e)) ctx.setOverlay(null);
  else if (overlay.kind === "config") {
    if (e.name === "e") ctx.setOverlay(null);
    else if (e.name === "v") ctx.setRevealEnv((r) => !r);
    else if (e.name === "y") ctx.copyEnv();
    else if (e.name === "return" || e.name === "enter") ctx.openEnvEdit("edit");
    else if (e.name === "a") ctx.openEnvEdit("add");
    else if (e.name === "x") {
      if (ctx.selectedEnv) {
        ctx.envActions.clearError();
        ctx.setPendingEnvDelete(ctx.selectedEnv);
      }
    } else if (e.name === "up" || e.name === "k") ctx.moveEnvCursor(-1);
    else if (e.name === "down" || e.name === "j") ctx.moveEnvCursor(1);
  } else if (e.name === "up" || e.name === "k") ctx.logScrollRef.current?.scrollBy(-1);
  else if (e.name === "down" || e.name === "j") ctx.logScrollRef.current?.scrollBy(1);
  else if (e.name === "pageup") ctx.logScrollRef.current?.scrollBy(-1, "viewport");
  else if (e.name === "pagedown") ctx.logScrollRef.current?.scrollBy(1, "viewport");
  return true;
};

// 6) global - keys live in every view (fall-through)
const globalKeys: KeyHandler = (e, ctx) => {
  if (isQuit(e)) ctx.exitApp();
  if (e.name === "?" || e.sequence === "?") {
    ctx.setHelpOpen(true);
    return true;
  }
  if (e.name === "tab") {
    ctx.setView((v) => (v === "resources" ? "servers" : "resources"));
    return true;
  }
  if (e.name === "c" && !ctx.noContexts) {
    ctx.setContextCursor(ctx.contexts.activeIndex);
    ctx.setContextOpen(true);
    return true;
  }
  // refresh moved to R; r is restart in the resources view. Shift+r arrives as sequence "R".
  if (e.sequence === "R") {
    if (ctx.view === "servers") ctx.servers.refresh();
    else ctx.list.refresh();
    return true;
  }
  return false;
};

// 7) resources-view-only keys (fall-through)
const resourceKeys: KeyHandler = (e, ctx) => {
  if (ctx.view !== "resources") return false;
  const { list, actions } = ctx;
  if (e.name === "/" || e.sequence === "/") {
    list.startFilter();
    return true;
  }
  if (e.name === "escape" && list.filter) {
    list.clearFilter();
    return true;
  }
  if (wantsDeployLog(e)) {
    const r = list.selectedRow;
    if (r && r.kind === "application") ctx.setOverlay({ kind: "deploy", resource: r });
    return true;
  }
  if (e.name === "l") {
    if (list.selectedRow) ctx.setOverlay({ kind: "runtime", resource: list.selectedRow });
    return true;
  }
  if (e.name === "e") {
    if (list.selectedRow) {
      ctx.setRevealEnv(false);
      ctx.setEnvCursor(0);
      ctx.setEnvEdit(null);
      ctx.setPendingEnvDelete(null);
      ctx.setOverlay({ kind: "config", resource: list.selectedRow });
    }
    return true;
  }
  const row = list.selectedRow;
  if (row && canAct(row)) {
    if (e.name === "s") {
      actions.request(row, toggleVerb(row.state));
      return true;
    }
    if (e.name === "r") {
      actions.request(row, "restart");
      return true;
    }
    if (e.name === "d" && canDeploy(row)) {
      actions.request(row, "deploy");
      return true;
    }
  }
  return false;
};

// 8) navigation, scoped to the active view (terminal handler)
const navKeys: KeyHandler = (e, ctx) => {
  const dir = e.name === "up" || e.name === "k" ? -1 : e.name === "down" || e.name === "j" ? 1 : 0;
  if (dir === 0) return false;
  if (ctx.view === "servers") ctx.servers.move(dir);
  else ctx.list.move(dir);
  return true;
};

const HANDLERS: ReadonlyArray<KeyHandler> = [
  splashKeys,
  filterKeys,
  confirmKeys,
  contextKeys,
  helpKeys,
  overlayKeys,
  globalKeys,
  resourceKeys,
  navKeys,
];

/** Run the event down the precedence chain until a handler owns it. */
export function dispatchKey(e: KeyEvent, ctx: KeyContext): void {
  for (const handler of HANDLERS) {
    if (handler(e, ctx)) return;
  }
}

// ── Display surfaces, co-located so a new key is documented where it's bound ──
// Footer groupings are editorial ("s/r/d act", "e/esc close") and intentionally
// not derived key-by-key, so the rendered strings stay exactly as designed.

/** The single footer hint line for the current view / overlay. */
export function footerHints(overlayKind: OverlayKind | null, view: View): string {
  if (overlayKind === "config") {
    return "↑↓ move   ↵ edit   a add   x del   v values   y copy   e/esc close   q quit";
  }
  if (overlayKind) {
    return "tailing   ↑↓ PgUp/PgDn scroll   esc close   q quit";
  }
  if (view === "servers") {
    return "↑↓/jk move   R refresh   c context   tab resources   ? help   q quit";
  }
  return "↑↓/jk move   / filter   l logs   L deploy   e config   s/r/d act   R refresh   c context   tab servers   ? help   q quit";
}

/** Source of truth for the help overlay (key, description), grouped by section. */
export const HELP_SECTIONS: ReadonlyArray<{
  title: string;
  keys: ReadonlyArray<readonly [string, string]>;
}> = [
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
    title: "logs & inspect",
    keys: [
      ["l", "runtime logs"],
      ["L", "deploy / build logs"],
      ["e", "config + env vars"],
      ["v", "reveal env values"],
      ["y", "copy env to clipboard"],
      ["↵", "edit selected env"],
      ["a", "add env (KEY=value)"],
      ["x", "delete selected env"],
      ["esc", "close overlay"],
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
