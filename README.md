# rumi

A fast, keyboard-driven terminal dashboard for [Coolify](https://coolify.io) — think `k9s`, but for your Coolify apps, services, and databases. Built on [OpenTUI](https://github.com/anomalyco/opentui) + React, running on [Bun](https://bun.sh).

```
   :%+-::::--:::            ██████╗  ██╗   ██╗ ███╗   ███╗ ██╗
  #@*-:-==----::::          ██╔══██╗ ██║   ██║ ████╗ ████║ ██║
 *@=-+++==+=-----::         ██████╔╝ ██║   ██║ ██╔████╔██║ ██║
 @@=********+=--:--         ██╔══██╗ ██║   ██║ ██║╚██╔╝██║ ██║
 =@*:*####*****+=--:        ██║  ██║ ╚██████╔╝ ██║ ╚═╝ ██║ ██║
  =*# :=*####*=+*=-:        ╚═╝  ╚═╝  ╚═════╝  ╚═╝     ╚═╝ ╚═╝
                            k9s-style control for Coolify
```

## Features

- **Live resource list** — apps, services, and databases with colored health status, grouped and filterable (`/`).
- **Lifecycle actions** — start/stop (`s`), restart (`r`), deploy (`d`), each behind a confirm prompt.
- **Logs** — tail runtime container logs (`l`) and deploy/build logs (`L`), auto-following a deploy you just triggered.
- **Config + env inspector** (`e`) — a resource's deployment configuration and env vars, with values masked by default (`v` to reveal).
- **Servers view** (`tab`) — reachability, usability, and build-server flags for your hosts.
- **Multiple instances** — switch between Coolify contexts (`c`); choices are remembered.
- **Self-updating** — `rumi update` pulls the latest release.

## Install

```sh
curl -fsSL https://raw.githubusercontent.com/Shironex/Rumi/main/install.sh | sh
```

This installs the right binary for your platform into `~/.local/bin` (override with `RUMI_INSTALL_DIR`). Make sure that directory is on your `PATH`.

Prebuilt binaries are published for **macOS** (arm64, x64) and **Linux** (x64, arm64) on the [releases page](https://github.com/Shironex/Rumi/releases).

## Configuration

rumi reads its instances from the same file as the official [Coolify CLI](https://coolify.io/docs/get-started/cli) — `~/.config/coolify/config.json`:

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
