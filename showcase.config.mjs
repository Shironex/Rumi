// Rebuilds the README images with `bun run showcase`: 8 stills, one keyboard-navigation clip and the hero banner,
// captured from rumi in a pseudo terminal under RUMI_MOCK=1. Mock mode serves invented sample data and freezes the
// clock, spinner and polling, so reruns produce the same stills. Set SHOWCASE_PORTFOLIO_DIR to a portfolio checkout
// (default: a sibling ../portfolio) to also export PNGs there. Runs under Node, which tty mode needs.

import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "@noctcore/showcase-kit";

const here = fileURLToPath(new URL(".", import.meta.url));

const portfolioRoot = process.env.SHOWCASE_PORTFOLIO_DIR
  ? resolve(process.env.SHOWCASE_PORTFOLIO_DIR)
  : resolve(here, "../portfolio");
const portfolioExists = existsSync(portfolioRoot);
if (!portfolioExists) {
  console.warn(
    `[showcase] Portfolio export skipped: no directory at ${portfolioRoot}. Set SHOWCASE_PORTFOLIO_DIR to export PNGs there.`,
  );
}

const background = { type: "gradient", from: "#bd93f9", to: "#0d1117", angle: 135 };

export default defineConfig({
  name: "rumi",
  slug: "rumi",
  langs: ["en"],

  target: {
    mode: "tty",
    command: ["bun", "run", "src/index.tsx"],
    env: { RUMI_MOCK: "1" },
    inheritEnv: false,
    cols: 160,
    rows: 40,
  },

  ready: "resources (",

  // rumi's own dark palette (src/theme.ts), so the unpainted canvas and the frame bar match the app.
  terminal: {
    theme: {
      background: "#0d1117",
      foreground: "#e6edf3",
      cursor: "#e6edf3",
      ansi: [
        "#484f58",
        "#ff7b72",
        "#3fb950",
        "#d29922",
        "#58a6ff",
        "#bd93f9",
        "#39c5cf",
        "#b1bac4",
        "#6e7681",
        "#ffa198",
        "#56d364",
        "#e3b341",
        "#79c0ff",
        "#d2a8ff",
        "#56d4dd",
        "#f0f6fc",
      ],
    },
  },

  // Every shot after the first starts a fresh app, so none depends on an Escape key from the one before.
  shots: [
    {
      id: "resources",
      title: "Resource list",
      caption: "Every app, service and database on the instance, sorted by kind with live status.",
      waitFor: "resources (",
    },
    {
      id: "runtime-logs",
      title: "Runtime logs",
      caption: "Tailing a running app's container logs.",
      restart: true,
      keys: ["l"],
      waitFor: "listening on :3000",
    },
    {
      id: "deploy-logs",
      title: "Deploy logs",
      caption: "The latest build and deploy log for the selected app.",
      restart: true,
      keys: ["L"],
      waitFor: "npm ci",
    },
    {
      id: "confirm-restart",
      title: "Confirm before acting",
      caption: "Every start, stop, restart or deploy sits behind a y/n confirm.",
      restart: true,
      keys: ["r"],
      waitFor: "Restart this resource?",
    },
    {
      id: "config-env",
      title: "Config and env inspector",
      caption: "Curated deploy config and env vars, values masked until revealed.",
      restart: true,
      keys: ["e"],
      waitFor: "DATABASE_URL",
    },
    {
      id: "servers",
      title: "Servers",
      caption: "Reachability, usability and build-server flags for every host.",
      restart: true,
      keys: ["{Tab}"],
      waitFor: "production-main",
    },
    {
      id: "context-switch",
      title: "Switch instance",
      caption: "Jump between configured Coolify instances without leaving the keyboard.",
      restart: true,
      keys: ["c"],
      waitFor: "switch context",
    },
    {
      id: "help",
      title: "Keybindings",
      caption: "Every key, one overlay away.",
      restart: true,
      keys: ["?"],
      waitFor: "esc / ? to close",
    },
  ],

  clips: [
    {
      id: "nav-demo",
      title: "Keyboard navigation",
      caption: "Moving through resources, opening logs and switching views, all from the keyboard.",
      fps: 10,
      formats: ["webp"],
      steps: [
        { waitFor: "resources (" },
        { sleep: 400 },
        { keys: "j" },
        { sleep: 300 },
        { keys: "j" },
        { sleep: 300 },
        { keys: "k" },
        { sleep: 300 },
        { keys: "k" },
        { sleep: 300 },
        { keys: "l" },
        { waitFor: "listening on :3000" },
        { sleep: 600 },
        // A second l closes the runtime logs, which avoids an Escape key.
        { keys: "l" },
        { sleep: 200 },
        { keys: "{Tab}" },
        { waitFor: "production-main" },
        { sleep: 600 },
        { keys: "{Tab}" },
        { waitFor: "resources (" },
        { sleep: 400 },
      ],
    },
  ],

  frame: {
    style: "terminal",
    theme: "dark",
    background,
    maxWidth: 1800,
  },

  hero: {
    layout: "stack",
    tagline: "Keyboard-driven dashboard for Coolify",
    logo: "assets/rumi.png",
    shots: ["config-env", "deploy-logs", "resources"],
    background,
    theme: "dark",
  },

  outputs: {
    raw: "showcase-out/raw/{id}.png",
    readme: "assets/showcase/{id}.webp",
    clips: "assets/showcase/{id}.{ext}",
    ...(portfolioExists
      ? {
          portfolio: {
            dir: join(portfolioRoot, "public/projects/{slug}"),
            format: "png",
            gallery: false,
          },
        }
      : {}),
  },
});
