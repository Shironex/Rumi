# Roadmap

A living plan for rumi. It is early and moves fast, so this list will change.
Dates are intentionally absent; things ship when they are ready.

## Unreleased

- **Clearer empty and error states.** Unreachable instances now surface an
  actionable message (on the splash and in every pane) instead of a raw fetch
  error; a misconfigured URL that returns non-JSON is named as such; a token
  without `read:sensitive` is flagged in the config inspector; and apps with no
  log output or no deployments get explicit empty states instead of a blank pane.
- **Copy env vars (`y`).** From the config inspector, copy a resource's env vars
  as a ready-to-paste `.env` block. Uses OSC 52 so it works over SSH; needs a
  `read:sensitive` token (otherwise there are only masked keys to copy).
- **Edit env vars in place.** The config inspector is no longer read-only: `↵`
  edits the selected var, `a` adds one (`KEY=value`), `x` deletes (behind a
  confirm). Needs a write-scoped token; changes apply on the next deploy. Update
  re-sends every flag so PATCH can't silently reset `is_literal` and friends.
- **Windows installer.** `install.ps1` (PowerShell one-liner) downloads the
  binary, drops it in `%LOCALAPPDATA%\Programs\rumi`, and adds it to the user PATH.

## Shipped (v0.1.0)

- Live resource list for apps, services, and databases with health status,
  grouping, and filtering (`/`).
- Lifecycle actions behind a confirm prompt: start/stop (`s`), restart (`r`),
  deploy (`d`).
- Runtime container logs (`l`) and deploy/build logs (`L`), auto-following a
  deploy you just triggered.
- Config + env inspector (`e`) with values masked by default and reveal (`v`).
- Servers view (`tab`) showing reachability, usability, and build-server flags.
- Multiple Coolify contexts (`c`), remembered between runs.
- ASCII splash screen while resources load.
- Self-update (`rumi update`).
- Prebuilt binaries for macOS (arm64, x64) and Linux (x64, arm64), plus an
  experimental Windows build.
- `install.sh`, CI (typecheck + headless render smoke on macOS, Linux, Windows),
  and a tag-driven release pipeline.

## Next up

- **x64 (Intel) macOS build.** v0.1.0 ships arm64 macOS only; the Intel smoke is
  flaky on the CI runner. Stabilize it and publish the x64 binary.
- **Windows polish.** `install.ps1` and the self-update rename dance now ship;
  next is a Scoop manifest and a wider soak of the dashboard on Windows Terminal.
- **Release hardening.** Confirm the multi-arch release pipeline end to end and
  smooth out anything the first real release surfaces.
- **More log coverage.** Service and database logs where the Coolify API exposes
  them, not just applications.

## Later / ideas

- Deployment history browsing, not just the latest deploy.
- Search across resources and contexts.
- Desktop notifications when a deploy finishes.
- Distribution via Homebrew, Scoop, and the AUR.
- Configurable accent color and keybindings.

## Non-goals (for now)

- Replacing the Coolify web UI. rumi is a fast keyboard companion, not a full
  replacement.
- Managing infrastructure outside Coolify's API surface.

Have an idea or hit a bug? Open an issue.
