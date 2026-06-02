import { chmodSync, renameSync, writeFileSync } from "node:fs";
import { VERSION } from "./version.ts";

const REPO = "Shironex/Rumi";

/** Release asset name for the running platform, e.g. "rumi-darwin-arm64". */
function assetName(): string | null {
  const os = process.platform === "darwin" ? "darwin" : process.platform === "linux" ? "linux" : null;
  const arch = process.arch === "arm64" ? "arm64" : process.arch === "x64" ? "x64" : null;
  return os && arch ? `rumi-${os}-${arch}` : null;
}

async function latestTag(): Promise<string> {
  const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
    headers: { Accept: "application/vnd.github+json", "User-Agent": "rumi-cli" },
  });
  if (!res.ok) throw new Error(`GitHub API responded ${res.status}`);
  const data = (await res.json()) as { tag_name?: string };
  return (data.tag_name ?? "").replace(/^v/, "");
}

/** Download the latest release binary for this platform and replace the running one. */
export async function runUpdate(): Promise<void> {
  const asset = assetName();
  if (!asset) {
    console.error(`Unsupported platform ${process.platform}/${process.arch}; build from source instead.`);
    return;
  }

  console.log(`rumi ${VERSION} · checking for updates…`);
  let latest: string;
  try {
    latest = await latestTag();
  } catch (err) {
    console.error(`Could not check for updates: ${(err as Error).message}`);
    return;
  }
  if (!latest) {
    console.error("No published release found yet.");
    return;
  }
  if (latest === VERSION) {
    console.log("Already on the latest version.");
    return;
  }

  console.log(`Updating ${VERSION} → ${latest}…`);
  const url = `https://github.com/${REPO}/releases/download/v${latest}/${asset}`;
  let bytes: ArrayBuffer;
  try {
    const res = await fetch(url, { headers: { "User-Agent": "rumi-cli" }, redirect: "follow" });
    if (!res.ok) throw new Error(`download responded ${res.status}`);
    bytes = await res.arrayBuffer();
  } catch (err) {
    console.error(`Download failed: ${(err as Error).message}`);
    return;
  }

  // Atomic replace: write next to the current binary, then rename over it. The
  // running process keeps its open inode, so swapping the path is safe.
  const target = process.execPath;
  const tmp = `${target}.new`;
  try {
    writeFileSync(tmp, new Uint8Array(bytes));
    chmodSync(tmp, 0o755);
    if (process.platform === "darwin") {
      // A downloaded binary can carry a quarantine xattr that blocks exec.
      Bun.spawnSync(["xattr", "-dr", "com.apple.quarantine", tmp]);
    }
    renameSync(tmp, target);
  } catch (err) {
    console.error(`Could not replace ${target}: ${(err as Error).message}`);
    console.error("If rumi is installed in a system dir, reinstall via install.sh instead.");
    return;
  }

  console.log(`Updated to ${latest}. Restart rumi to use it.`);
}
