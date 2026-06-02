import { createCliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";
import { App } from "./app.tsx";
import { runUpdate } from "./update.ts";
import { VERSION } from "./version.ts";

function help(): void {
  console.log(`rumi ${VERSION} — k9s-style control for Coolify

Usage:
  rumi             launch the dashboard
  rumi update      update to the latest release
  rumi --version   print the version
  rumi --help      show this help

Inside the dashboard, press ? for the keybindings.`);
}

const arg = process.argv[2];

switch (arg) {
  case "-v":
  case "--version":
  case "version":
    console.log(`rumi ${VERSION}`);
    break;
  case "-h":
  case "--help":
  case "help":
    help();
    break;
  case "update":
  case "upgrade":
    await runUpdate();
    break;
  default: {
    // Best-effort cleanup of the previous binary left behind by a Windows self-update.
    if (process.platform === "win32") {
      try {
        const { rmSync } = await import("node:fs");
        rmSync(`${process.execPath}.old`, { force: true });
      } catch {
        // ignore — the old binary may still be locked; next launch retries.
      }
    }
    const renderer = await createCliRenderer();
    // OpenTUI's own uncaught handler only console.errors — it never tears the
    // renderer down, and process.exit() skips its beforeExit cleanup. Without
    // this, an uncaught render error or stray rejection prints a stack into the
    // alt-screen and leaves the terminal in alt-screen + mouse-tracking + hidden
    // cursor. Restore the terminal first, then report on the normal screen and
    // exit non-zero.
    const die = (err: unknown) => {
      try {
        renderer.destroy();
      } catch {
        // already torn down — fall through to reporting
      }
      console.error(err);
      process.exit(1);
    };
    process.on("uncaughtException", die);
    process.on("unhandledRejection", die);
    createRoot(renderer).render(<App />);
  }
}
