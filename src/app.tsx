import { useState } from "react";
import { useKeyboard, useTerminalDimensions } from "@opentui/react";
import { ConfirmModal } from "./components/confirm-modal.tsx";
import { ContextModal } from "./components/context-modal.tsx";
import { DetailPane } from "./components/detail-pane.tsx";
import { FooterBar } from "./components/footer-bar.tsx";
import { HeaderBar } from "./components/header-bar.tsx";
import { LogsPane } from "./components/logs-pane.tsx";
import { Onboarding } from "./components/onboarding.tsx";
import { ResourcesTable } from "./components/resources-table.tsx";
import { ServersPane } from "./components/servers-pane.tsx";
import { canAct, canDeploy, toggleVerb } from "./coolify/actions.ts";
import type { CoolifyResource } from "./coolify/types.ts";
import { useActions } from "./hooks/use-actions.ts";
import { useContexts } from "./hooks/use-contexts.ts";
import { useLogs } from "./hooks/use-logs.ts";
import { useResourceList } from "./hooks/use-resource-list.ts";
import { useServers } from "./hooks/use-servers.ts";
import { clamp } from "./util.ts";

type View = "resources" | "servers";

const LOGS_HEIGHT = 14;

export function App() {
  const contexts = useContexts();
  const list = useResourceList(contexts.active);
  const [view, setView] = useState<View>("resources");
  const servers = useServers(contexts.active, view === "servers");
  const [logsResource, setLogsResource] = useState<CoolifyResource | undefined>(undefined);
  const logsOpen = logsResource !== undefined;
  const logs = useLogs(contexts.active, logsResource, logsOpen);
  const actions = useActions(contexts.active, list.refresh);
  const [contextOpen, setContextOpen] = useState(false);
  const [contextCursor, setContextCursor] = useState(0);
  const { width, height } = useTerminalDimensions();

  const noContexts = contexts.contexts.length === 0;
  const lastContext = Math.max(0, contexts.contexts.length - 1);

  // useKeyboard wraps this in useEffectEvent, so it always sees current state - no refs needed.
  useKeyboard((e) => {
    const quit = e.name === "q" || (e.ctrl && e.name === "c");

    // 1) filter input mode swallows everything
    if (list.filterMode) {
      list.handleFilterKey(e);
      return;
    }
    // 2) confirm modal: y confirms, esc / n cancels (never Enter - too reflexive)
    if (actions.pending) {
      if (quit) process.exit(0);
      if (e.name === "y") actions.confirm();
      else if (e.name === "escape" || e.name === "n") actions.cancel();
      return;
    }
    // 3) context switcher modal
    if (contextOpen) {
      if (quit) process.exit(0);
      if (e.name === "escape" || e.name === "c") setContextOpen(false);
      else if (e.name === "up" || e.name === "k") setContextCursor((c) => clamp(c - 1, 0, lastContext));
      else if (e.name === "down" || e.name === "j") setContextCursor((c) => clamp(c + 1, 0, lastContext));
      else if (e.name === "return" || e.name === "enter") {
        contexts.select(contextCursor);
        setContextOpen(false);
      }
      return;
    }
    // 4) logs overlay (quit stays live; nav is disabled while tailing)
    if (logsOpen) {
      if (quit) process.exit(0);
      if (e.name === "escape" || e.name === "l") setLogsResource(undefined);
      return;
    }

    // 5) global - keys live in every view
    if (quit) process.exit(0);
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

    // 6) resources-view-only keys
    if (view === "resources") {
      if (e.name === "/" || e.sequence === "/") {
        list.startFilter();
        return;
      }
      if (e.name === "escape" && list.filter) {
        list.clearFilter();
        return;
      }
      if (e.name === "l") {
        if (list.selectedRow) setLogsResource(list.selectedRow);
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

    // 7) navigation, scoped to the active view
    const dir = e.name === "up" || e.name === "k" ? -1 : e.name === "down" || e.name === "j" ? 1 : 0;
    if (dir !== 0) {
      if (view === "servers") servers.move(dir);
      else list.move(dir);
    }
  });

  const viewportHeight = Math.max(3, height - 7 - (logsOpen ? LOGS_HEIGHT : 0));

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
          />
          <DetailPane resource={list.selectedRow} focused={false} />
        </box>
      )}

      {logsResource ? (
        <LogsPane
          resource={logsResource}
          lines={logs.lines}
          loading={logs.loading}
          error={logs.error}
          supported={logs.supported}
          height={LOGS_HEIGHT}
          maxWidth={width - 6}
          focused
        />
      ) : null}

      <FooterBar filterMode={list.filterMode} filter={list.filter} logsOpen={logsOpen} view={view} />

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
    </box>
  );
}
