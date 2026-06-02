# Roadmap

A living plan for rumi. It is early and moves fast, so this list will change.
Dates are intentionally absent; things ship when they are ready.

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
- **Windows polish.** A proper `install.ps1` with PATH handling, plus a pass on
  the self-update rename dance and terminal restore on quit.
- **Release hardening.** Confirm the multi-arch release pipeline end to end and
  smooth out anything the first real release surfaces.
- **Better empty and error states.** Clearer messaging when a context is
  unreachable, a token lacks scope, or a resource has no logs.
- **More log coverage.** Service and database logs where the Coolify API exposes
  them, not just applications.

## Later / ideas

- Deployment history browsing, not just the latest deploy.
- Editing env vars in place (currently read-only).
- Search across resources and contexts.
- Desktop notifications when a deploy finishes.
- Distribution via Homebrew, Scoop, and the AUR.
- Configurable accent color and keybindings.

## Non-goals (for now)

- Replacing the Coolify web UI. rumi is a fast keyboard companion, not a full
  replacement.
- Managing infrastructure outside Coolify's API surface.

Have an idea or hit a bug? Open an issue.
