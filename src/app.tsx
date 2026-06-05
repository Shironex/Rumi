import { useEffect, useRef, useState } from "react";
import type { ScrollBoxRenderable } from "@opentui/core";
import { useKeyboard, useRenderer, useTerminalDimensions } from "@opentui/react";
import { ConfigPane } from "./components/config-pane.tsx";
import { ConfirmModal } from "./components/confirm-modal.tsx";
import { ContextModal } from "./components/context-modal.tsx";
import { DeployLogsPane } from "./components/deploy-logs-pane.tsx";
import { EnvEditModal } from "./components/env-edit-modal.tsx";
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
import { copyText } from "./clipboard.ts";
import { type EnvVar, envFileBlock, isTerminalStatus, parseEnvAssignment } from "./coolify/types.ts";
import { USE_MOCK } from "./env.ts";
import { useActions } from "./hooks/use-actions.ts";
import { useConfig } from "./hooks/use-config.ts";
import { useContexts } from "./hooks/use-contexts.ts";
import { useDeployLogs } from "./hooks/use-deploy-logs.ts";
import { useEnvActions } from "./hooks/use-env-actions.ts";
import { useLogs } from "./hooks/use-logs.ts";
import { useResourceList } from "./hooks/use-resource-list.ts";
import { useServers } from "./hooks/use-servers.ts";
import { useSpinner } from "./hooks/use-spinner.ts";
import { useToast } from "./hooks/use-toast.ts";
import { dispatchKey, type EnvEdit, type KeyContext, type Overlay, type View } from "./keymap.ts";
import { clamp } from "./util.ts";

const LOGS_HEIGHT = 14;
const CONFIG_HEIGHT = 18;

export function App() {
  const contexts = useContexts();
  const list = useResourceList(contexts.active);
  const [view, setView] = useState<View>("resources");
  const servers = useServers(contexts.active, view === "servers");
  const [overlay, setOverlay] = useState<Overlay | null>(null);
  const overlayOpen = overlay !== null;
  const logs = useLogs(
    contexts.active,
    overlay?.kind === "runtime" ? overlay.resource : undefined,
    overlay?.kind === "runtime",
  );
  const deployLogs = useDeployLogs(
    contexts.active,
    overlay?.kind === "deploy" ? overlay.resource : undefined,
    overlay?.kind === "deploy" ? overlay.trackUuid : undefined,
    overlay?.kind === "deploy",
  );
  const config = useConfig(
    contexts.active,
    overlay?.kind === "config" ? overlay.resource : undefined,
    overlay?.kind === "config",
  );
  const [revealEnv, setRevealEnv] = useState(false);
  const [envCursor, setEnvCursor] = useState(0);
  const [envEdit, setEnvEdit] = useState<EnvEdit | null>(null);
  const [pendingEnvDelete, setPendingEnvDelete] = useState<EnvVar | null>(null);
  const toast = useToast();
  const actions = useActions(contexts.active, (resource, id, deploymentUuid) => {
    list.refresh();
    toast.show(`${resource.name} · ${id} requested`);
    // After a build-triggering action on an app, tail that exact deployment.
    if (resource.kind === "application" && id !== "stop" && (USE_MOCK || deploymentUuid)) {
      setOverlay({ kind: "deploy", resource, trackUuid: deploymentUuid });
    }
  });
  const envActions = useEnvActions(
    contexts.active,
    overlay?.kind === "config" ? overlay.resource : undefined,
    (summary) => {
      config.reload();
      toast.show(`${summary} · redeploy (d) to apply`);
    },
  );
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

  // Copy the open resource's env vars to the clipboard as a .env block (OSC 52,
  // so it works over SSH). Gated on the token actually carrying values — without
  // read:sensitive there's nothing but masked keys to copy.
  const copyEnv = () => {
    if (!config.valuesAvailable) {
      toast.show("Env values hidden (token lacks read:sensitive)", "warn");
      return;
    }
    const block = envFileBlock(config.envs);
    if (!block) {
      toast.show("No env vars to copy", "warn");
      return;
    }
    const n = block.split("\n").length;
    if (copyText(block)) toast.show(`Copied ${n} env var${n === 1 ? "" : "s"}`);
    else toast.show("No terminal clipboard available", "warn");
  };

  // Env cursor, clamped to the current list so a delete/reload can't strand it.
  const envCount = config.envs.length;
  const envSel = envCount === 0 ? -1 : clamp(envCursor, 0, envCount - 1);
  // Move via a functional updater (reads React's latest cursor, so key-repeat
  // doesn't drop moves) and read the count from a live ref refreshed each render,
  // never from the captured closure.
  const envCountRef = useRef(0);
  envCountRef.current = envCount;
  const moveEnvCursor = (delta: number) =>
    setEnvCursor((c) => clamp(c + delta, 0, Math.max(0, envCountRef.current - 1)));
  const selectedEnv = envSel >= 0 ? config.envs[envSel] : undefined;

  const openEnvEdit = (mode: "edit" | "add") => {
    envActions.clearError();
    if (mode === "add") {
      setEnvEdit({ mode: "add", key: "", draft: "" });
    } else if (selectedEnv) {
      setEnvEdit({ mode: "edit", key: selectedEnv.key, draft: selectedEnv.value ?? "" });
    }
  };

  const submitEnvEdit = () => {
    if (!envEdit || envActions.busy) return;
    if (envEdit.mode === "add") {
      const parsed = parseEnvAssignment(envEdit.draft);
      if (!parsed) {
        toast.show("Use KEY=value with a valid key name", "warn");
        return;
      }
      void envActions.create(parsed.key, parsed.value).then((ok) => ok && setEnvEdit(null));
      return;
    }
    const env = config.envs.find((e) => e.key === envEdit.key);
    if (!env) {
      setEnvEdit(null);
      return;
    }
    // Guard the secret-wipe: a hidden/shown-once value seeds an empty draft, so an
    // empty submit would overwrite the live secret with "". Require a real value.
    if (env.value === undefined && envEdit.draft === "") {
      toast.show("Type a value — the current one is hidden", "warn");
      return;
    }
    void envActions.update(env, envEdit.draft).then((ok) => ok && setEnvEdit(null));
  };

  const doEnvDelete = () => {
    if (!pendingEnvDelete || envActions.busy) return;
    void envActions.remove(pendingEnvDelete).then((ok) => {
      if (ok) {
        setPendingEnvDelete(null);
        setEnvCursor((c) => clamp(c, 0, Math.max(0, envCount - 2)));
      }
    });
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

  // Build the key context fresh each render and run it down the precedence chain
  // in keymap.ts (see KeyContext for why it must not be captured or memoized).
  const keyCtx: KeyContext = {
    showSplash,
    setSplashSkipped,
    exitApp,
    list,
    actions,
    servers,
    contexts,
    envActions,
    view,
    setView,
    noContexts,
    contextOpen,
    setContextOpen,
    contextCursor,
    setContextCursor,
    lastContext,
    helpOpen,
    setHelpOpen,
    overlay,
    setOverlay,
    envEdit,
    setEnvEdit,
    pendingEnvDelete,
    setPendingEnvDelete,
    setRevealEnv,
    setEnvCursor,
    selectedEnv,
    moveEnvCursor,
    openEnvEdit,
    submitEnvEdit,
    doEnvDelete,
    copyEnv,
    logScrollRef,
  };
  useKeyboard((e) => dispatchKey(e, keyCtx));

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
        <Onboarding configError={contexts.error} />
      ) : view === "servers" ? (
        <box flexDirection="row" flexGrow={1}>
          <ServersPane
            servers={servers.servers}
            selectedIndex={servers.selected}
            loading={servers.loading}
            error={servers.error}
            lastUpdated={servers.lastUpdated}
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
          selectedIndex={envSel}
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

      {overlay?.kind === "config" && envEdit ? (
        <EnvEditModal
          mode={envEdit.mode}
          envKey={envEdit.key}
          draft={envEdit.draft}
          busy={envActions.busy}
          error={envActions.error}
          valueHidden={envEdit.mode === "edit" && config.envs.find((e) => e.key === envEdit.key)?.value === undefined}
        />
      ) : null}

      {overlay?.kind === "config" && pendingEnvDelete ? (
        <ConfirmModal
          verb="Delete"
          subject="this env var"
          busyText="deleting…"
          target={pendingEnvDelete.key}
          busy={envActions.busy}
          error={envActions.error}
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
