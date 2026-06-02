import { useEffect, useRef, useState } from "react";
import type { ScrollBoxRenderable } from "@opentui/core";
import { useKeyboard, useRenderer, useTerminalDimensions } from "@opentui/react";
import { ConfigPane } from "./components/config-pane.tsx";
import { ConfirmModal } from "./components/confirm-modal.tsx";
import { ContextModal } from "./components/context-modal.tsx";
import { DeployLogsPane } from "./components/deploy-logs-pane.tsx";
import { DetailPane } from "./components/detail-pane.tsx";
import { FooterBar } from "./components/footer-bar.tsx";
import { HeaderBar } from "./components/header-bar.tsx";
import { HelpOverlay } from "./components/help-overlay.tsx";
import { LogsPane } from "./components/logs-pane.tsx";
import { Onboarding } from "./components/onboarding.tsx";
import { ResourcesTable } from "./components/resources-table.tsx";
import { ServersPane } from "./components/servers-pane.tsx";
import { Splash } from "./components/splash.tsx";
import { Toast } from "./components/toast.tsx";
import { canAct, canDeploy, toggleVerb } from "./coolify/actions.ts";
import { type CoolifyResource, isTerminalStatus } from "./coolify/types.ts";
import { useActions } from "./hooks/use-actions.ts";
import { useConfig } from "./hooks/use-config.ts";
import { useContexts } from "./hooks/use-contexts.ts";
import { useDeployLogs } from "./hooks/use-deploy-logs.ts";
import { useLogs } from "./hooks/use-logs.ts";
import { useResourceList } from "./hooks/use-resource-list.ts";
import { useServers } from "./hooks/use-servers.ts";
import { useSpinner } from "./hooks/use-spinner.ts";
import { useToast } from "./hooks/use-toast.ts";
import { clamp } from "./util.ts";

type View = "resources" | "servers";
type Overlay =
  | { kind: "runtime"; resource: CoolifyResource }
  | { kind: "deploy"; resource: CoolifyResource; trackUuid?: string }
  | { kind: "config"; resource: CoolifyResource };

const LOGS_HEIGHT = 14;
const CONFIG_HEIGHT = 18;
const USE_MOCK = process.env.RUMI_MOCK === "1";

export function App() {
  const contexts = useContexts();
  const list = useResourceList(contexts.active);
  const [view, setView] = useState<View>("resources");
  const servers = useServers(contexts.active, view === "servers");
  const [overlay, setOverlay] = useState<Overlay | null>(null);
  const overlayOpen = overlay !== null;
  const logs = useLogs(contexts.active, overlay?.kind === "runtime" ? overlay.resource : undefined, overlay?.kind === "runtime");
  const deployLogs = useDeployLogs(
    contexts.active,
    overlay?.kind === "deploy" ? overlay.resource : undefined,
    overlay?.kind === "deploy" ? overlay.trackUuid : undefined,
    overlay?.kind === "deploy",
  );
  const config = useConfig(contexts.active, overlay?.kind === "config" ? overlay.resource : undefined, overlay?.kind === "config");
  const [revealEnv, setRevealEnv] = useState(false);
  const toast = useToast();
  const actions = useActions(contexts.active, (resource, id, deploymentUuid) => {
    list.refresh();
    toast.show(`${resource.name} · ${id} requested`);
    // After a build-triggering action on an app, tail that exact deployment.
    if (resource.kind === "application" && id !== "stop" && (USE_MOCK || deploymentUuid)) {
      setOverlay({ kind: "deploy", resource, trackUuid: deploymentUuid });
    }
  });
  const [contextOpen, setContextOpen] = useState(false);
  const [contextCursor, setContextCursor] = useState(0);
  const [helpOpen, setHelpOpen] = useState(false);
  const [splashSkipped, setSplashSkipped] = useState(false);
  const [minSplashElapsed, setMinSplashElapsed] = useState(USE_MOCK);
  const logScrollRef = useRef<ScrollBoxRenderable | null>(null);
  const { width, height } = useTerminalDimensions();
  const renderer = useRenderer();

  // Tear the renderer down before exiting so the terminal is restored (mouse
  // tracking off, alt-screen left, cursor shown). A bare process.exit(0) skips
  // OpenTUI's beforeExit handler and leaks mouse escape codes into the shell.
  const exitApp = () => {
    renderer.destroy();
    process.exit(0);
  };

  const noContexts = contexts.contexts.length === 0;
  const lastContext = Math.max(0, contexts.contexts.length - 1);

  // Splash shows until the first fetch lands (and a brief floor passes so it
  // doesn't just flash); any key skips it. Skipped entirely when no context.
  const loaded = list.lastUpdated != null;
  const showSplash = !noContexts && !splashSkipped && (!loaded || !minSplashElapsed);
  useEffect(() => {
    if (USE_MOCK) return;
    const t = setTimeout(() => setMinSplashElapsed(true), 700);
    return () => clearTimeout(t);
  }, []);

  // Animate only when something is actually in motion (keeps the render quiet otherwise).
  const deployRunning =
    overlay?.kind === "deploy" && deployLogs.deployment != null && !isTerminalStatus(deployLogs.deployment.status);
  const spinner = useSpinner(showSplash || list.filtered.some((r) => r.state === "transitioning") || deployRunning);

  // useKeyboard wraps this in useEffectEvent, so it always sees current state - no refs needed.
  useKeyboard((e) => {
    const quit = e.name === "q" || (e.ctrl && e.name === "c");
    const wantsDeployLog = e.sequence === "L" || (e.name === "l" && e.shift);

    // 0) splash: any key skips it (quit still quits)
    if (showSplash) {
      if (quit) exitApp();
      else setSplashSkipped(true);
      return;
    }
    // 1) filter input mode swallows everything
    if (list.filterMode) {
      list.handleFilterKey(e);
      return;
    }
    // 2) confirm modal: y confirms, esc / n cancels (never Enter, too reflexive)
    if (actions.pending) {
      if (quit) exitApp();
      if (e.name === "y") actions.confirm();
      else if (e.name === "escape" || e.name === "n") actions.cancel();
      return;
    }
    // 3) context switcher modal
    if (contextOpen) {
      if (quit) exitApp();
      if (e.name === "escape" || e.name === "c") setContextOpen(false);
      else if (e.name === "up" || e.name === "k") setContextCursor((c) => clamp(c - 1, 0, lastContext));
      else if (e.name === "down" || e.name === "j") setContextCursor((c) => clamp(c + 1, 0, lastContext));
      else if (e.name === "return" || e.name === "enter") {
        contexts.select(contextCursor);
        setContextOpen(false);
      }
      return;
    }
    // 4) help overlay: esc / ? dismisses (quit stays live)
    if (helpOpen) {
      if (quit) exitApp();
      if (e.name === "escape" || e.name === "?" || e.sequence === "?") setHelpOpen(false);
      return;
    }
    // 5) logs / deploy-logs overlay: esc/key closes; arrows scroll history (sticky auto-tails)
    if (overlay) {
      if (quit) exitApp();
      if (e.name === "escape") setOverlay(null);
      else if (overlay.kind === "runtime" && e.name === "l") setOverlay(null);
      else if (overlay.kind === "deploy" && wantsDeployLog) setOverlay(null);
      else if (overlay.kind === "config" && e.name === "e") setOverlay(null);
      else if (overlay.kind === "config" && e.name === "v") setRevealEnv((r) => !r);
      else if (e.name === "up" || e.name === "k") logScrollRef.current?.scrollBy(-1);
      else if (e.name === "down" || e.name === "j") logScrollRef.current?.scrollBy(1);
      else if (e.name === "pageup") logScrollRef.current?.scrollBy(-1, "viewport");
      else if (e.name === "pagedown") logScrollRef.current?.scrollBy(1, "viewport");
      return;
    }

    // 6) global - keys live in every view
    if (quit) exitApp();
    if (e.name === "?" || e.sequence === "?") {
      setHelpOpen(true);
      return;
    }
    if (e.name === "tab") {
      setView((v) => (v === "resources" ? "servers" : "resources"));
      return;
    }
    if (e.name === "c" && !noContexts) {
      setContextCursor(contexts.activeIndex);
      setContextOpen(true);
      return;
    }
    // refresh moved to R; r is restart in the resources view. Shift+r arrives as sequence "R".
    if (e.sequence === "R") {
      if (view === "servers") servers.refresh();
      else list.refresh();
      return;
    }

    // 7) resources-view-only keys
    if (view === "resources") {
      if (e.name === "/" || e.sequence === "/") {
        list.startFilter();
        return;
      }
      if (e.name === "escape" && list.filter) {
        list.clearFilter();
        return;
      }
      if (wantsDeployLog) {
        const r = list.selectedRow;
        if (r && r.kind === "application") setOverlay({ kind: "deploy", resource: r });
        return;
      }
      if (e.name === "l") {
        if (list.selectedRow) setOverlay({ kind: "runtime", resource: list.selectedRow });
        return;
      }
      if (e.name === "e") {
        if (list.selectedRow) {
          setRevealEnv(false);
          setOverlay({ kind: "config", resource: list.selectedRow });
        }
        return;
      }
      const row = list.selectedRow;
      if (row && canAct(row)) {
        if (e.name === "s") {
          actions.request(row, toggleVerb(row.state));
          return;
        }
        if (e.name === "r") {
          actions.request(row, "restart");
          return;
        }
        if (e.name === "d" && canDeploy(row)) {
          actions.request(row, "deploy");
          return;
        }
      }
    }

    // 8) navigation, scoped to the active view
    const dir = e.name === "up" || e.name === "k" ? -1 : e.name === "down" || e.name === "j" ? 1 : 0;
    if (dir !== 0) {
      if (view === "servers") servers.move(dir);
      else list.move(dir);
    }
  });

  const overlayHeight = overlay?.kind === "config" ? CONFIG_HEIGHT : LOGS_HEIGHT;
  const viewportHeight = Math.max(3, height - 7 - (overlayOpen ? overlayHeight : 0));

  if (showSplash) {
    return <Splash contextName={contexts.active?.name} error={list.error} spinner={spinner} />;
  }

  return (
    <box flexDirection="column" flexGrow={1} paddingLeft={1} paddingRight={1}>
      <HeaderBar
        contextName={contexts.active?.name}
        loading={list.loading}
        error={list.error}
        running={list.counts.running}
        problems={list.counts.problems}
        lastUpdated={list.lastUpdated}
        total={list.total}
      />

      {noContexts ? (
        <Onboarding />
      ) : view === "servers" ? (
        <box flexDirection="row" flexGrow={1}>
          <ServersPane
            servers={servers.servers}
            selectedIndex={servers.selected}
            loading={servers.loading}
            error={servers.error}
            viewportHeight={viewportHeight}
          />
        </box>
      ) : (
        <box flexDirection="row" flexGrow={1}>
          <ResourcesTable
            resources={list.filtered}
            total={list.total}
            filter={list.filter}
            selectedIndex={list.selected}
            focused
            viewportHeight={viewportHeight}
            loading={list.loading}
            error={list.error}
            spinner={spinner}
          />
          <DetailPane resource={list.selectedRow} focused={false} />
        </box>
      )}

      {overlay?.kind === "runtime" ? (
        <LogsPane
          resource={overlay.resource}
          lines={logs.lines}
          loading={logs.loading}
          error={logs.error}
          supported={logs.supported}
          height={LOGS_HEIGHT}
          maxWidth={width - 6}
          focused
          scrollRef={logScrollRef}
        />
      ) : overlay?.kind === "deploy" ? (
        <DeployLogsPane
          name={overlay.resource.name}
          deployment={deployLogs.deployment}
          loading={deployLogs.loading}
          error={deployLogs.error}
          supported={deployLogs.supported}
          height={LOGS_HEIGHT}
          maxWidth={width - 6}
          focused
          scrollRef={logScrollRef}
          spinner={spinner}
        />
      ) : overlay?.kind === "config" ? (
        <ConfigPane
          name={overlay.resource.name}
          config={config.config}
          envs={config.envs}
          valuesAvailable={config.valuesAvailable}
          reveal={revealEnv}
          loading={config.loading}
          error={config.error}
          supported={config.supported}
          height={CONFIG_HEIGHT}
          maxWidth={width - 6}
          focused
          scrollRef={logScrollRef}
        />
      ) : null}

      <FooterBar filterMode={list.filterMode} filter={list.filter} overlayKind={overlay?.kind ?? null} view={view} />

      {actions.pending ? (
        <ConfirmModal
          verb={actions.pending.verb}
          target={actions.pending.resource.name}
          busy={actions.busy}
          error={actions.error}
        />
      ) : null}

      {contextOpen ? (
        <ContextModal contexts={contexts.contexts} activeIndex={contexts.activeIndex} cursor={contextCursor} />
      ) : null}

      {helpOpen ? <HelpOverlay /> : null}

      {toast.toast ? <Toast text={toast.toast.text} tone={toast.toast.tone} /> : null}
    </box>
  );
}
