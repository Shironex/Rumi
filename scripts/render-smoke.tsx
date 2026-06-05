/**
 * Headless render smoke: mount the real <App/> against OpenTUI's in-memory test
 * renderer and assert the panes paint (catches reconciler/layout throws a
 * bundle/typecheck can't), including the logs overlay driven via mock keypresses.
 * Run: RUMI_MOCK=1 bun run scripts/render-smoke.tsx
 */
import { testRender } from "@opentui/react/test-utils";
import { App } from "../src/app.tsx";
import { ConfigPane } from "../src/components/config-pane.tsx";
import { DeployLogsPane } from "../src/components/deploy-logs-pane.tsx";
import { LogsPane } from "../src/components/logs-pane.tsx";
import { Onboarding } from "../src/components/onboarding.tsx";
import { ResourcesTable } from "../src/components/resources-table.tsx";
import { ServersPane } from "../src/components/servers-pane.tsx";
import { Splash } from "../src/components/splash.tsx";
import { CoolifyConnectionError, toServer } from "../src/coolify/client.ts";
import { mockEnvVars, mockResources } from "../src/coolify/mock.ts";

if (process.env.RUMI_MOCK !== "1") {
  console.error("Run with RUMI_MOCK=1 so it uses sample data, not the live API.");
  process.exit(1);
}

// Hard watchdog so CI can never hang. waitForFrame awaits the renderer's next
// frame; if the scheduler reports "running" but stops emitting frames (seen
// intermittently on Linux and Windows runners) that await never resolves and
// maxPasses can't bound it. Turn a deadlock into a fast failure. The last
// "ok  -" line printed before this fires shows which step was reached. Every
// success/failure path below calls process.exit(), which cancels this timer.
const SMOKE_TIMEOUT_MS = Number(process.env.SMOKE_TIMEOUT_MS ?? 120_000);
// unref so this never delays a legit fast failure (a maxPasses rejection); on a
// real hang the renderer's own handles keep the loop alive, so it still fires.
setTimeout(() => {
  console.error(`\nFAIL: smoke timed out after ${SMOKE_TIMEOUT_MS}ms (render/waitForFrame deadlock).`);
  process.exit(1);
}, SMOKE_TIMEOUT_MS).unref();

// OpenTUI drives state updates (spinner, polling) from timers that fire outside
// React's act(), so testRender warns "not wrapped in act(...)" on every async
// update. Locally that is ~30 lines; on a slower CI runner the waits span many
// more timer ticks, ballooning it into thousands of lines whose stderr writes
// make the smoke crawl and look like an infinite loop. Drop just that warning;
// real errors (assert failures, the watchdog) still pass through.
const realConsoleError = console.error.bind(console);
console.error = (...args: unknown[]): void => {
  if (typeof args[0] === "string" && args[0].includes("not wrapped in act")) return;
  realConsoleError(...args);
};

function assert(cond: boolean, msg: string): void {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exit(1);
  }
  console.log("ok  -", msg);
}

const t = await testRender(<App />, { width: 160, height: 40 });
await t.waitForFrame((f) => f.includes("lunofi-api"), { maxPasses: 300 });
const frame = t.captureCharFrame();

assert(frame.includes("rumi"), "header renders");
assert(frame.includes("c context"), "context-switch hint in footer");
assert(frame.includes("shini"), "configured context shows");
assert(frame.includes("resources"), "resources pane renders");
assert(frame.includes("lunofi-api"), "resource row renders");
assert(frame.includes("detail"), "detail pane renders");
assert(frame.includes("domains") || frame.includes("branch"), "detail fields render for selected app");
assert(frame.includes("filter"), "footer hints render");

// Logs overlay for an application (selection starts on lunofi-api). Wait for the
// log lines themselves, not just the pane header: the lines land a frame later
// (set inside the hook's effect), so gating on the header alone races in CI.
t.mockInput.pressKey("l");
await t.waitForFrame((f) => f.includes("listening on :3000") || f.includes("starting up"), { maxPasses: 300 });
const appLogs = t.captureCharFrame();
assert(appLogs.includes("logs ·"), "logs pane opens for an app");
assert(appLogs.includes("listening on :3000") || appLogs.includes("starting up"), "log lines tail");
t.renderer.destroy();

// Unsupported state for non-applications - rendered standalone (avoids brittle
// multi-keypress nav; the message path is the only thing under test here).
const db = mockResources().find((r) => r.kind === "database")!;
const u = await testRender(
  <LogsPane
    resource={db}
    lines={[]}
    loading={false}
    error={null}
    supported={false}
    height={14}
    maxWidth={120}
    focused
  />,
  { width: 140, height: 16 },
);
await u.waitForFrame((f) => f.includes("applications only"), { maxPasses: 200 });
assert(u.captureCharFrame().includes("applications only"), "unsupported logs message for database");
u.renderer.destroy();

// Empty/error states the mock never exercises (mock always returns content), so
// render the panes standalone like the unsupported case above.
const app = mockResources().find((r) => r.kind === "application")!;

// A running app that simply hasn't logged anything (Coolify returns "").
const empty = await testRender(
  <LogsPane resource={app} lines={[""]} loading={false} error={null} supported height={14} maxWidth={120} focused />,
  { width: 140, height: 16 },
);
await empty.waitForFrame((f) => f.includes("No log output yet"), { maxPasses: 200 });
assert(empty.captureCharFrame().includes("No log output yet"), "logs pane shows a no-output empty state");
empty.renderer.destroy();

// An unreachable instance — the friendly CoolifyConnectionError message, not a raw fetch error.
const connErr = new CoolifyConnectionError("shini", "https://shinictl.xyz", new Error("connect ECONNREFUSED"));
const err = await testRender(
  <LogsPane
    resource={app}
    lines={[]}
    loading={false}
    error={connErr.message}
    supported
    height={14}
    maxWidth={120}
    focused
  />,
  { width: 140, height: 16 },
);
await err.waitForFrame((f) => f.includes("Can't reach"), { maxPasses: 200 });
assert(err.captureCharFrame().includes("Can't reach"), "panes render the friendly unreachable-context message");
err.renderer.destroy();

// An app that has never been deployed — distinct from "still waiting for a build".
const nodep = await testRender(
  <DeployLogsPane
    name="lunofi-api"
    deployment={null}
    loading={false}
    error={null}
    supported
    height={14}
    maxWidth={120}
    focused
  />,
  { width: 140, height: 16 },
);
await nodep.waitForFrame((f) => f.includes("No deployments yet"), { maxPasses: 200 });
assert(nodep.captureCharFrame().includes("No deployments yet"), "deploy pane shows a never-deployed empty state");
nodep.renderer.destroy();

// Env values present but the token can't read them (no read:sensitive) — the
// config pane calls that out instead of looking like a rumi bug.
const noscope = await testRender(
  <ConfigPane
    name="lunofi-api"
    config={[]}
    envs={mockEnvVars()}
    valuesAvailable={false}
    reveal={false}
    loading={false}
    error={null}
    supported
    height={18}
    maxWidth={120}
    focused
  />,
  { width: 140, height: 20 },
);
await noscope.waitForFrame((f) => f.includes("read:sensitive"), { maxPasses: 200 });
assert(
  noscope.captureCharFrame().includes("token lacks read:sensitive"),
  "config pane flags a token without the read:sensitive scope",
);
noscope.renderer.destroy();

// Action confirm modal - fresh App so selection is the first app (lunofi-api).
const a = await testRender(<App />, { width: 160, height: 40 });
await a.waitForFrame((f) => f.includes("lunofi-api"), { maxPasses: 300 });
a.mockInput.pressKey("r");
await a.waitForFrame((f) => f.includes("Restart this resource?"), { maxPasses: 300 });
const confirmFrame = a.captureCharFrame();
assert(confirmFrame.includes("Restart this resource?"), "restart key opens the confirm modal");
assert(confirmFrame.includes("y confirm"), "confirm modal shows the y/n prompt");

// Confirming a restart on an app auto-opens the deploy/build log.
a.mockInput.pressKey("y");
await a.waitForFrame((f) => f.includes("npm ci"), { maxPasses: 300 });
const deployFrame = a.captureCharFrame();
assert(deployFrame.includes("deploy ·"), "confirming restart auto-opens deploy logs");
assert(deployFrame.includes("npm ci"), "deploy build lines render");
assert(!deployFrame.includes("coolify-helper"), "hidden build steps are filtered out");
assert(deployFrame.includes("restart requested"), "action fires a confirmation toast");
a.renderer.destroy();

// Deploy logs on demand (shift+l) without triggering an action.
const dl = await testRender(<App />, { width: 160, height: 40 });
await dl.waitForFrame((f) => f.includes("lunofi-api"), { maxPasses: 300 });
dl.mockInput.pressKey("l", { shift: true });
await dl.waitForFrame((f) => f.includes("deploy ·"), { maxPasses: 300 });
assert(dl.captureCharFrame().includes("deploy ·"), "shift+l opens deploy logs on demand");
dl.renderer.destroy();

// Context switcher modal - fresh App, real contexts loaded from the CLI config.
const b = await testRender(<App />, { width: 160, height: 40 });
await b.waitForFrame((f) => f.includes("lunofi-api"), { maxPasses: 300 });
b.mockInput.pressKey("c");
await b.waitForFrame((f) => f.includes("switch context"), { maxPasses: 300 });
assert(b.captureCharFrame().includes("switch context"), "c opens the context switcher");
b.renderer.destroy();

// Help overlay opens on ?.
const hp = await testRender(<App />, { width: 160, height: 40 });
await hp.waitForFrame((f) => f.includes("lunofi-api"), { maxPasses: 300 });
hp.mockInput.pressKey("?");
await hp.waitForFrame((f) => f.includes("rumi · keys"), { maxPasses: 300 });
assert(hp.captureCharFrame().includes("rumi · keys"), "? opens the help overlay");
assert(hp.captureCharFrame().includes("copy env to clipboard"), "help lists the copy-env key");
hp.renderer.destroy();

// Config + env inspector opens on e (selection starts on lunofi-api, an app).
const ci = await testRender(<App />, { width: 160, height: 40 });
await ci.waitForFrame((f) => f.includes("lunofi-api"), { maxPasses: 300 });
ci.mockInput.pressKey("e");
await ci.waitForFrame((f) => f.includes("DATABASE_URL"), { maxPasses: 300 });
const cfgFrame = ci.captureCharFrame();
assert(cfgFrame.includes("config ·"), "e opens the config + env inspector");
assert(cfgFrame.includes("y copy"), "config footer advertises the copy-env key");
assert(cfgFrame.includes("DATABASE_URL"), "env keys render in the inspector");
assert(cfgFrame.includes("nixpacks"), "curated config fields render");
assert(cfgFrame.includes("••"), "env values are masked by default");
assert(!cfgFrame.includes("s3cr3t"), "masked values stay hidden");

// v reveals the real env values.
ci.mockInput.pressKey("v");
await ci.waitForFrame((f) => f.includes("s3cr3t"), { maxPasses: 300 });
assert(ci.captureCharFrame().includes("s3cr3t"), "v reveals env values");

// y copies the env block. The OSC 52 write is gated on a TTY, so under the piped
// smoke it no-ops — this only proves the keypress->copyEnv path doesn't throw and
// the inspector stays up. The actual clipboard write is a manual check in a real term.
ci.mockInput.pressKey("y");
await ci.waitForFrame((f) => f.includes("config ·"), { maxPasses: 300 });
assert(ci.captureCharFrame().includes("config ·"), "y (copy env) keeps the inspector rendered");

// ↵ edits the selected var (DATABASE_URL, the first row). Submitting in mock skips
// the network and fires the "updated" toast — exercises the update wiring end-to-end.
ci.mockInput.pressEnter();
await ci.waitForFrame((f) => f.includes("edit DATABASE_URL"), { maxPasses: 300 });
assert(ci.captureCharFrame().includes("edit DATABASE_URL"), "↵ opens the env value editor");
ci.mockInput.pressEnter();
await ci.waitForFrame((f) => f.includes("DATABASE_URL updated"), { maxPasses: 300 });
assert(ci.captureCharFrame().includes("DATABASE_URL updated"), "submitting an edit reports the update");

// a adds a var via a typed KEY=value line; create wiring fires the "added" toast.
ci.mockInput.pressKey("a");
await ci.waitForFrame((f) => f.includes("add env var"), { maxPasses: 300 });
ci.mockInput.typeText("FOO=bar");
await ci.waitForFrame((f) => f.includes("FOO=bar"), { maxPasses: 300 });
assert(ci.captureCharFrame().includes("FOO=bar"), "typed input lands in the add editor");
ci.mockInput.pressEnter();
await ci.waitForFrame((f) => f.includes("FOO added"), { maxPasses: 300 });
assert(ci.captureCharFrame().includes("FOO added"), "submitting an add reports the new var");

// x asks to confirm, then y deletes (mock) and reports it.
ci.mockInput.pressKey("x");
await ci.waitForFrame((f) => f.includes("Delete this env var"), { maxPasses: 300 });
const del = ci.captureCharFrame();
assert(del.includes("Delete this env var"), "x opens the env delete confirm");
assert(del.includes("DATABASE_URL"), "delete confirm names the target var");
ci.mockInput.pressKey("y");
await ci.waitForFrame((f) => f.includes("DATABASE_URL deleted"), { maxPasses: 300 });
assert(ci.captureCharFrame().includes("DATABASE_URL deleted"), "y confirms the env delete");

// ↓ moves the env cursor off row 0 (single press — the renderer races back-to-back
// keypresses, but the cursor up/down logic is covered by the move helper either way).
ci.mockInput.pressKey("j");
await ci.waitForFrame((f) => f.includes("▸ NODE_ENV"), { maxPasses: 300 });
assert(ci.captureCharFrame().includes("▸ NODE_ENV"), "↓ moves the env cursor");
ci.renderer.destroy();

// Splash screen - rendered standalone (in-app it auto-dismisses once data loads).
const sp = await testRender(<Splash contextName="shini" error={null} spinner="⠋" />, { width: 90, height: 48 });
await sp.waitForFrame((f) => f.includes("connecting to shini"), { maxPasses: 200 });
const splashFrame = sp.captureCharFrame();
assert(splashFrame.includes("@@@"), "splash ascii art renders");
assert(splashFrame.includes("k9s-style control for Coolify"), "splash tagline renders");
assert(splashFrame.includes("press any key to skip"), "splash skip hint renders");
sp.renderer.destroy();

// Splash error state - the first-load unreachable case surfaces here (data never
// lands, so the splash stays up); it must show the actionable message, not spin.
const spErr = await testRender(
  <Splash
    contextName="shini"
    error={'Can\'t reach "shini" (https://shinictl.xyz). Check the instance is online and the URL is correct.'}
    spinner="⠋"
  />,
  { width: 90, height: 48 },
);
await spErr.waitForFrame((f) => f.includes("Can't reach"), { maxPasses: 200 });
const spErrFrame = spErr.captureCharFrame();
assert(spErrFrame.includes("Can't reach"), "splash surfaces the unreachable-context message");
assert(spErrFrame.includes("press any key to continue"), "splash error swaps the skip hint for continue");
spErr.renderer.destroy();

// Onboarding empty state - rendered standalone (only paints at 0 contexts).
const o = await testRender(<Onboarding />, { width: 100, height: 16 });
await o.waitForFrame((f) => f.includes("Welcome to rumi"), { maxPasses: 200 });
assert(o.captureCharFrame().includes("No Coolify instance is configured"), "onboarding empty state renders");
o.renderer.destroy();

// Servers view - fresh App, tab switches resources -> servers.
const s = await testRender(<App />, { width: 160, height: 40 });
await s.waitForFrame((f) => f.includes("lunofi-api"), { maxPasses: 300 });
s.mockInput.pressTab();
await s.waitForFrame((f) => f.includes("production-main"), { maxPasses: 300 });
const serversFrame = s.captureCharFrame();
assert(serversFrame.includes("servers ("), "tab switches to the servers view");
assert(serversFrame.includes("production-main"), "server row renders");
s.renderer.destroy();

// Reachability is read from the nested `settings` object the live Coolify API
// uses (toServer once read only the top level, so every server showed red
// "unreachable"). Map a raw server with nested settings and assert the pane
// renders it ready — exercises the real toServer->ServersPane path the mock skips.
const nested = toServer({
  uuid: "srv-n",
  name: "nested-host",
  ip: "9.9.9.9",
  settings: { is_reachable: true, is_usable: true },
});
const sv = await testRender(
  <ServersPane servers={[nested]} selectedIndex={0} loading={false} error={null} viewportHeight={10} />,
  { width: 140, height: 16 },
);
await sv.waitForFrame((f) => f.includes("nested-host"), { maxPasses: 200 });
const svFrame = sv.captureCharFrame();
assert(svFrame.includes("ready"), "server reachability reads from nested settings (C1)");
assert(!svFrame.includes("unreachable"), "nested-settings server is not mislabeled unreachable (C1)");
sv.renderer.destroy();

// A transient poll error must NOT blank a table that already has rows — the hook
// keeps last-good data, so the pane should keep rendering it (S4).
const rErr = await testRender(
  <ResourcesTable
    resources={mockResources()}
    total={7}
    filter=""
    selectedIndex={0}
    focused
    viewportHeight={10}
    loading={false}
    error="Coolify API error 500"
  />,
  { width: 140, height: 16 },
);
await rErr.waitForFrame((f) => f.includes("lunofi-api"), { maxPasses: 200 });
assert(
  rErr.captureCharFrame().includes("lunofi-api"),
  "resources table keeps last-good rows on a transient poll error (S4)",
);
rErr.renderer.destroy();

const svErr = await testRender(
  <ServersPane
    servers={[nested]}
    selectedIndex={0}
    loading={false}
    error="Coolify API error 500"
    viewportHeight={10}
  />,
  { width: 140, height: 16 },
);
await svErr.waitForFrame((f) => f.includes("nested-host"), { maxPasses: 200 });
const svErrFrame = svErr.captureCharFrame();
assert(svErrFrame.includes("nested-host"), "servers pane keeps last-good rows on a transient poll error (S4)");
assert(svErrFrame.includes("Coolify API error 500"), "servers pane surfaces the error as a warning line (S4)");
svErr.renderer.destroy();

// Servers view shows a last-updated timestamp in its title (parity with resources) (N5).
const svFresh = await testRender(
  <ServersPane
    servers={[nested]}
    selectedIndex={0}
    loading={false}
    error={null}
    viewportHeight={10}
    lastUpdated={1733155822000}
  />,
  { width: 140, height: 16 },
);
await svFresh.waitForFrame((f) => f.includes("nested-host"), { maxPasses: 200 });
assert(svFresh.captureCharFrame().includes("servers (1) ·"), "servers pane shows a last-updated timestamp (N5)");
svFresh.renderer.destroy();

// A config file that exists but can't be parsed must show the reason, not the
// first-run "nothing configured" copy (S5).
const oErr = await testRender(<Onboarding configError={"Unexpected end of JSON input"} />, { width: 100, height: 16 });
await oErr.waitForFrame((f) => f.includes("Couldn't read"), { maxPasses: 200 });
const oErrFrame = oErr.captureCharFrame();
assert(oErrFrame.includes("Couldn't read your Coolify config"), "onboarding surfaces a broken-config error (S5)");
assert(oErrFrame.includes("Unexpected end of JSON input"), "broken-config error shows the parse reason (S5)");
oErr.renderer.destroy();

console.log("\nrender smoke passed.\n");
console.log(appLogs);
process.exit(0);
