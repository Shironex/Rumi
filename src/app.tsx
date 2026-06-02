import { useState } from "react";
import { useKeyboard, useTerminalDimensions } from "@opentui/react";
import { ConfirmModal } from "./components/confirm-modal.tsx";
import { ContextsPane } from "./components/contexts-pane.tsx";
import { DetailPane } from "./components/detail-pane.tsx";
import { FooterBar } from "./components/footer-bar.tsx";
import { HeaderBar } from "./components/header-bar.tsx";
import { LogsPane } from "./components/logs-pane.tsx";
import { ResourcesTable } from "./components/resources-table.tsx";
import { canAct, canDeploy, toggleVerb } from "./coolify/actions.ts";
import type { CoolifyResource } from "./coolify/types.ts";
import { useActions } from "./hooks/use-actions.ts";
import { useContexts } from "./hooks/use-contexts.ts";
import { useLogs } from "./hooks/use-logs.ts";
import { useResourceList } from "./hooks/use-resource-list.ts";

type Pane = "contexts" | "resources";

const LOGS_HEIGHT = 14;

export function App() {
  const contexts = useContexts();
  const list = useResourceList(contexts.active);
  const [focus, setFocus] = useState<Pane>("resources");
  const [logsResource, setLogsResource] = useState<CoolifyResource | undefined>(undefined);
  const logsOpen = logsResource !== undefined;
  const logs = useLogs(contexts.active, logsResource, logsOpen);
  const actions = useActions(contexts.active, list.refresh);
  const { width, height } = useTerminalDimensions();

  // useKeyboard wraps this in useEffectEvent, so it always sees current state — no refs needed.
  useKeyboard((e) => {
    // 1) filter input mode swallows everything
    if (list.filterMode) {
      list.handleFilterKey(e);
      return;
    }
    // 2) confirm modal is fully modal: y confirms, esc / n cancels (never Enter — too reflexive)
    if (actions.pending) {
      if (e.name === "q" || (e.ctrl && e.name === "c")) process.exit(0);
      if (e.name === "y") actions.confirm();
      else if (e.name === "escape" || e.name === "n") actions.cancel();
      return;
    }
    // 3) logs overlay (quit stays live; nav is disabled while tailing)
    if (logsOpen) {
      if (e.name === "q" || (e.ctrl && e.name === "c")) process.exit(0);
      if (e.name === "escape" || e.name === "l") setLogsResource(undefined);
      return;
    }
    // 4) global
    if (e.name === "/" || e.sequence === "/") {
      setFocus("resources");
      list.startFilter();
      return;
    }
    if (e.name === "escape" && list.filter) {
      list.clearFilter();
      return;
    }
    if (e.name === "q" || (e.ctrl && e.name === "c")) process.exit(0);
    if (e.name === "tab") {
      setFocus((f) => (f === "contexts" ? "resources" : "contexts"));
      return;
    }
    if (e.name === "l") {
      if (list.selectedRow) setLogsResource(list.selectedRow);
      return;
    }
    // refresh moved to R; r is now restart (PRD). Shift+r arrives as sequence "R".
    if (e.sequence === "R") {
      list.refresh();
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
    const up = e.name === "up" || e.name === "k";
    const down = e.name === "down" || e.name === "j";
    if (!up && !down) return;
    const step = down ? 1 : -1;
    if (focus === "contexts") contexts.move(step);
    else list.move(step);
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

      <box flexDirection="row" flexGrow={1}>
        <ContextsPane contexts={contexts.contexts} activeIndex={contexts.activeIndex} focused={focus === "contexts"} />
        <ResourcesTable
          resources={list.filtered}
          total={list.total}
          filter={list.filter}
          selectedIndex={list.selected}
          focused={focus === "resources"}
          viewportHeight={viewportHeight}
          loading={list.loading}
          error={list.error}
        />
        <DetailPane resource={list.selectedRow} focused={false} />
      </box>

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

      <FooterBar filterMode={list.filterMode} filter={list.filter} focus={focus} logsOpen={logsOpen} />

      {actions.pending ? (
        <ConfirmModal
          verb={actions.pending.verb}
          target={actions.pending.resource.name}
          busy={actions.busy}
          error={actions.error}
        />
      ) : null}
    </box>
  );
}
