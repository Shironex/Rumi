/**
 * Headless render smoke: mount the real <App/> against OpenTUI's in-memory test
 * renderer and assert the panes paint (catches reconciler/layout throws a
 * bundle/typecheck can't), including the logs overlay driven via mock keypresses.
 * Run: RUMI_MOCK=1 bun run scripts/render-smoke.tsx
 */
import { testRender } from "@opentui/react/test-utils";
import { App } from "../src/app.tsx";
import { LogsPane } from "../src/components/logs-pane.tsx";
import { Onboarding } from "../src/components/onboarding.tsx";
import { Splash } from "../src/components/splash.tsx";
import { mockResources } from "../src/coolify/mock.ts";

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

// Unsupported state for non-applications - rendered standalone (avoids brittle
// multi-keypress nav; the message path is the only thing under test here).
const db = mockResources().find((r) => r.kind === "database")!;
const u = await testRender(
  <LogsPane resource={db} lines={[]} loading={false} error={null} supported={false} height={14} maxWidth={120} focused />,
  { width: 140, height: 16 },
);
await u.waitForFrame((f) => f.includes("applications only"), { maxPasses: 200 });
assert(u.captureCharFrame().includes("applications only"), "unsupported logs message for database");

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

// Deploy logs on demand (shift+l) without triggering an action.
const dl = await testRender(<App />, { width: 160, height: 40 });
await dl.waitForFrame((f) => f.includes("lunofi-api"), { maxPasses: 300 });
dl.mockInput.pressKey("l", { shift: true });
await dl.waitForFrame((f) => f.includes("deploy ·"), { maxPasses: 300 });
assert(dl.captureCharFrame().includes("deploy ·"), "shift+l opens deploy logs on demand");

// Context switcher modal - fresh App, real contexts loaded from the CLI config.
const b = await testRender(<App />, { width: 160, height: 40 });
await b.waitForFrame((f) => f.includes("lunofi-api"), { maxPasses: 300 });
b.mockInput.pressKey("c");
await b.waitForFrame((f) => f.includes("switch context"), { maxPasses: 300 });
assert(b.captureCharFrame().includes("switch context"), "c opens the context switcher");

// Help overlay opens on ?.
const hp = await testRender(<App />, { width: 160, height: 40 });
await hp.waitForFrame((f) => f.includes("lunofi-api"), { maxPasses: 300 });
hp.mockInput.pressKey("?");
await hp.waitForFrame((f) => f.includes("rumi · keys"), { maxPasses: 300 });
assert(hp.captureCharFrame().includes("rumi · keys"), "? opens the help overlay");

// Config + env inspector opens on e (selection starts on lunofi-api, an app).
const ci = await testRender(<App />, { width: 160, height: 40 });
await ci.waitForFrame((f) => f.includes("lunofi-api"), { maxPasses: 300 });
ci.mockInput.pressKey("e");
await ci.waitForFrame((f) => f.includes("DATABASE_URL"), { maxPasses: 300 });
const cfgFrame = ci.captureCharFrame();
assert(cfgFrame.includes("config ·"), "e opens the config + env inspector");
assert(cfgFrame.includes("DATABASE_URL"), "env keys render in the inspector");
assert(cfgFrame.includes("nixpacks"), "curated config fields render");
assert(cfgFrame.includes("••"), "env values are masked by default");
assert(!cfgFrame.includes("s3cr3t"), "masked values stay hidden");

// v reveals the real env values.
ci.mockInput.pressKey("v");
await ci.waitForFrame((f) => f.includes("s3cr3t"), { maxPasses: 300 });
assert(ci.captureCharFrame().includes("s3cr3t"), "v reveals env values");

// Splash screen - rendered standalone (in-app it auto-dismisses once data loads).
const sp = await testRender(<Splash contextName="shini" error={null} spinner="⠋" />, { width: 90, height: 48 });
await sp.waitForFrame((f) => f.includes("connecting to shini"), { maxPasses: 200 });
const splashFrame = sp.captureCharFrame();
assert(splashFrame.includes("@@@"), "splash ascii art renders");
assert(splashFrame.includes("k9s-style control for Coolify"), "splash tagline renders");
assert(splashFrame.includes("press any key to skip"), "splash skip hint renders");

// Onboarding empty state - rendered standalone (only paints at 0 contexts).
const o = await testRender(<Onboarding />, { width: 100, height: 16 });
await o.waitForFrame((f) => f.includes("Welcome to rumi"), { maxPasses: 200 });
assert(o.captureCharFrame().includes("No Coolify instance is configured"), "onboarding empty state renders");

// Servers view - fresh App, tab switches resources -> servers.
const s = await testRender(<App />, { width: 160, height: 40 });
await s.waitForFrame((f) => f.includes("lunofi-api"), { maxPasses: 300 });
s.mockInput.pressTab();
await s.waitForFrame((f) => f.includes("production-main"), { maxPasses: 300 });
const serversFrame = s.captureCharFrame();
assert(serversFrame.includes("servers ("), "tab switches to the servers view");
assert(serversFrame.includes("production-main"), "server row renders");

console.log("\nrender smoke passed.\n");
console.log(appLogs);
process.exit(0);
