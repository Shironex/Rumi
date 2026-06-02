/**
 * Headless render smoke: mount the real <App/> against OpenTUI's in-memory test
 * renderer and assert the panes paint (catches reconciler/layout throws a
 * bundle/typecheck can't), including the logs overlay driven via mock keypresses.
 * Run: KANRISHA_MOCK=1 bun run scripts/render-smoke.tsx
 */
import { testRender } from "@opentui/react/test-utils";
import { App } from "../src/app.tsx";
import { LogsPane } from "../src/components/logs-pane.tsx";
import { mockResources } from "../src/coolify/mock.ts";

if (process.env.KANRISHA_MOCK !== "1") {
  console.error("Run with KANRISHA_MOCK=1 so it uses sample data, not the live API.");
  process.exit(1);
}

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

assert(frame.includes("kanrisha"), "header renders");
assert(frame.includes("contexts"), "contexts pane renders");
assert(frame.includes("shini"), "configured context shows");
assert(frame.includes("resources"), "resources pane renders");
assert(frame.includes("lunofi-api"), "resource row renders");
assert(frame.includes("detail"), "detail pane renders");
assert(frame.includes("domains") || frame.includes("branch"), "detail fields render for selected app");
assert(frame.includes("filter"), "footer hints render");

// Logs overlay for an application (selection starts on lunofi-api).
t.mockInput.pressKey("l");
await t.waitForFrame((f) => f.includes("logs ·"), { maxPasses: 300 });
const appLogs = t.captureCharFrame();
assert(appLogs.includes("logs ·"), "logs pane opens for an app");
assert(appLogs.includes("listening on :3000") || appLogs.includes("starting up"), "log lines tail");

// Unsupported state for non-applications — rendered standalone (avoids brittle
// multi-keypress nav; the message path is the only thing under test here).
const db = mockResources().find((r) => r.kind === "database")!;
const u = await testRender(
  <LogsPane resource={db} lines={[]} loading={false} error={null} supported={false} height={14} maxWidth={120} focused />,
  { width: 140, height: 16 },
);
await u.waitForFrame((f) => f.includes("applications only"), { maxPasses: 200 });
assert(u.captureCharFrame().includes("applications only"), "unsupported logs message for database");

console.log("\nrender smoke passed.\n");
console.log(appLogs);
process.exit(0);
