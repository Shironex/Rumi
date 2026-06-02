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
    const renderer = await createCliRenderer();
    createRoot(renderer).render(<App />);
  }
}
