import { chmodSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { VERSION } from "./version.ts";

const REPO = "Shironex/Rumi";

/** Release asset name for the running platform, e.g. "rumi-macos-arm64" / "rumi-windows-x64.exe". */
function assetName(): string | null {
  const os =
    process.platform === "darwin"
      ? "macos"
      : process.platform === "linux"
        ? "linux"
        : process.platform === "win32"
          ? "windows"
          : null;
  const arch = process.arch === "arm64" ? "arm64" : process.arch === "x64" ? "x64" : null;
  if (!os || !arch) return null;
  return `rumi-${os}-${arch}${os === "windows" ? ".exe" : ""}`;
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

  const target = process.execPath;
  // Set once we've moved the running Windows binary aside, so a failed write can
  // be rolled back instead of leaving nothing at `target`.
  let windowsBackup: string | null = null;
  try {
    if (process.platform === "win32") {
      // Windows locks a running .exe: it can't be overwritten or deleted, but it
      // CAN be renamed. Move the running binary aside, write the new one in its
      // place; the leftover .old is cleaned up on next launch (see index.tsx).
      const old = `${target}.old`;
      rmSync(old, { force: true });
      renameSync(target, old);
      windowsBackup = old;
      writeFileSync(target, new Uint8Array(bytes));
    } else {
      // Atomic replace: write alongside, then rename over. The running process
      // keeps its open inode, so swapping the path is safe.
      const tmp = `${target}.new`;
      writeFileSync(tmp, new Uint8Array(bytes));
      chmodSync(tmp, 0o755);
      // A downloaded binary can carry a quarantine xattr that blocks exec on macOS.
      if (process.platform === "darwin") Bun.spawnSync(["xattr", "-dr", "com.apple.quarantine", tmp]);
      renameSync(tmp, target);
    }
  } catch (err) {
    // If we moved the running Windows binary aside but the write failed, restore
    // it so a failed update is a no-op rather than leaving the user with no binary.
    if (windowsBackup) {
      try {
        renameSync(windowsBackup, target);
      } catch {
        // restore failed too — the reinstall hint below is the recovery path.
      }
    }
    console.error(`Could not replace ${target}: ${(err as Error).message}`);
    console.error("If rumi is installed in a system dir, reinstall instead.");
    return;
  }

  console.log(`Updated to ${latest}. Restart rumi to use it.`);
}
