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
    createRoot(renderer).render(<App />);
  }
}
