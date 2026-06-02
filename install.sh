#!/usr/bin/env sh
# Install the latest rumi release for this platform.
#   curl -fsSL https://raw.githubusercontent.com/Shironex/Rumi/main/install.sh | sh
# Override the destination with RUMI_INSTALL_DIR=/somewhere.
set -eu

REPO="Shironex/Rumi"
INSTALL_DIR="${RUMI_INSTALL_DIR:-$HOME/.local/bin}"

os="$(uname -s)"
arch="$(uname -m)"
case "$os" in
  Darwin) os="darwin" ;;
  Linux) os="linux" ;;
  *) echo "Unsupported OS: $os" >&2; exit 1 ;;
esac
case "$arch" in
  arm64 | aarch64) arch="arm64" ;;
  x86_64 | amd64) arch="x64" ;;
  *) echo "Unsupported architecture: $arch" >&2; exit 1 ;;
esac

asset="rumi-${os}-${arch}"
url="https://github.com/${REPO}/releases/latest/download/${asset}"

echo "Installing rumi (${os}-${arch}) into ${INSTALL_DIR}…"
mkdir -p "$INSTALL_DIR"
tmp="$(mktemp)"
if ! curl -fsSL "$url" -o "$tmp"; then
  echo "Download failed. No release asset at: $url" >&2
  rm -f "$tmp"
  exit 1
fi
chmod +x "$tmp"
# Strip the quarantine xattr a download can set on macOS, so the binary execs.
[ "$os" = "darwin" ] && xattr -dr com.apple.quarantine "$tmp" 2>/dev/null || true
mv "$tmp" "$INSTALL_DIR/rumi"

echo "Installed rumi to ${INSTALL_DIR}/rumi"
case ":$PATH:" in
  *":$INSTALL_DIR:"*) echo "Run: rumi" ;;
  *) echo "Add ${INSTALL_DIR} to your PATH, then run: rumi" ;;
esac
