<a name="top"></a>

<div align="center">

<img src="assets/rumi.png" alt="rumi" width="180" height="180" />

<h1>rumi</h1>

<strong>A fast, keyboard-driven terminal dashboard for <a href="https://coolify.io">Coolify</a>.</strong>

Think `k9s`, but for your Coolify apps, services, and databases.

<p>
  <a href="https://github.com/Shironex/Rumi/releases/latest"><img src="https://img.shields.io/github/v/release/Shironex/Rumi?style=flat&color=bd93f9" alt="Release" /></a>
  <a href="https://github.com/Shironex/Rumi/releases"><img src="https://img.shields.io/github/downloads/Shironex/Rumi/total?style=flat&color=bd93f9" alt="Downloads" /></a>
  <a href="https://github.com/Shironex/Rumi/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/Shironex/Rumi/ci.yml?branch=main&style=flat&label=ci" alt="CI" /></a>
  <img src="https://img.shields.io/badge/platform-macOS%20%7C%20Linux%20%7C%20Windows-lightgrey?style=flat" alt="Platform" />
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-bd93f9?style=flat" alt="License" /></a>
</p>

<p>
  <a href="#install"><strong>Install</strong></a>
  &nbsp;·&nbsp;
  <a href="https://github.com/Shironex/Rumi/releases">Releases</a>
  &nbsp;·&nbsp;
  <a href="#keys">Keys</a>
  &nbsp;·&nbsp;
  <a href="#build-from-source">Build</a>
</p>

</div>

> **Early development.** rumi is a young project under active development. Expect rough edges, missing features, and the occasional breaking change before a stable 1.0 release. Feedback and issues are welcome.

---

Built on [OpenTUI](https://github.com/anomalyco/opentui) + React, running on [Bun](https://bun.sh). Point it at your Coolify instance and drive deploys, logs, and config from the terminal without leaving your keyboard.

## Features

| Feature | What it does |
| --- | --- |
| **Live resource list** | Apps, services, and databases with colored health status, grouped and filterable (`/`). |
| **Lifecycle actions** | Start/stop (`s`), restart (`r`), deploy (`d`), each behind a confirm prompt. |
| **Logs** | Tail runtime container logs (`l`) and deploy/build logs (`L`), auto-following a deploy you just triggered. |
| **Config + env inspector** | Inspect a resource's deployment config and env vars (`e`); values masked by default, `v` to reveal. |
| **Servers view** | Reachability, usability, and build-server flags for your hosts (`tab`). |
| **Multiple instances** | Switch between Coolify contexts (`c`); your choice is remembered. |
| **Self-updating** | `rumi update` pulls the latest release in place. |

## Install

```sh
curl -fsSL https://raw.githubusercontent.com/Shironex/Rumi/main/install.sh | sh
```

This installs the right binary for your platform into `~/.local/bin` (override with `RUMI_INSTALL_DIR`). Make sure that directory is on your `PATH`.

Prebuilt binaries are published for **macOS** (arm64, x64) and **Linux** (x64, arm64) on the [releases page](https://github.com/Shironex/Rumi/releases).

### Windows

Windows support is new and still being polished, but the dashboard renders and runs. Download `rumi-windows-x64.exe` from the [releases page](https://github.com/Shironex/Rumi/releases), put it somewhere on your `PATH`, and run `rumi`. `rumi update` works on Windows too. It reads contexts from `%APPDATA%\coolify\config.json`, the same file the Coolify CLI uses.

## Configuration

rumi reads its instances from the same file as the official [Coolify CLI](https://coolify.io/docs/get-started/cli), `~/.config/coolify/config.json`:

```json
{
  "instances": [
    { "name": "shini", "fqdn": "https://your-coolify.example.com", "token": "<api-token>", "default": true }
  ]
}
```

Create an API token in Coolify under **Settings → API**, and make sure the API is enabled and your IP is allow-listed there. A token with the `read:sensitive` scope is needed to reveal env values; without it, rumi shows env keys only.

## Usage

```sh
rumi            # launch the dashboard
rumi update     # update to the latest release
rumi --version  # print the version
rumi --help     # show help
```

### Keys

| Key | Action |
| --- | --- |
| `↑ ↓` / `j k` | move selection |
| `tab` | toggle resources / servers |
| `/` | filter resources |
| `c` | switch Coolify context |
| `s` | start / stop |
| `r` | restart |
| `d` | deploy |
| `R` | refresh now |
| `l` | runtime logs |
| `L` | deploy / build logs |
| `e` | config + env inspector |
| `v` | reveal env values (in the inspector) |
| `?` | help |
| `q` / `^C` | quit |

## Build from source

Requires [Bun](https://bun.sh).

```sh
bun install
bun run start            # run from source
bun run smoke            # headless render test
bun build --compile ./src/index.tsx --outfile rumi   # standalone binary
```

The splash art is generated from an image with `bun run scripts/make-splash.ts <image> --write` (needs `ffmpeg`).

## License

[MIT](LICENSE) © Shironex

<p align="center"><a href="#top">Back to top</a></p>
