/**
 * Clipboard via OSC 52 — the terminal escape that copies to the system clipboard.
 *
 * Chosen over shelling out to pbcopy/clip/xclip because it works *through SSH*:
 * the escape travels up the same TTY rumi is already drawing on, so a copy on a
 * remote box lands on the local clipboard. That is exactly rumi's use case.
 *
 * Caveat: OSC 52 has no acknowledgement and not every terminal honors it —
 * macOS Terminal.app ignores it, and tmux needs `set -g set-clipboard on`. So a
 * "copied" toast is best-effort, not a guarantee; an empty clipboard afterwards is
 * a terminal-config issue, not a rumi bug.
 */

/** Build the OSC 52 sequence for `text`, tmux-wrapped when running inside tmux. */
export function osc52(text: string, tmux = Boolean(process.env.TMUX)): string {
  // Buffer, not btoa: btoa throws/corrupts on non-Latin1, and env values hold unicode.
  const b64 = Buffer.from(text, "utf8").toString("base64");
  const seq = `\x1b]52;c;${b64}\x07`;
  // Inside tmux a bare OSC 52 is swallowed by tmux itself; wrap it in a DCS
  // passthrough with every inner ESC doubled so tmux forwards it to the outer term.
  if (tmux) return `\x1bPtmux;${seq.replaceAll("\x1b", "\x1b\x1b")}\x1b\\`;
  return seq;
}

/** Copy `text` to the system clipboard via OSC 52. Returns false when there's no TTY to write to. */
export function copyText(text: string, out: NodeJS.WriteStream = process.stdout): boolean {
  if (!out.isTTY) return false;
  out.write(osc52(text));
  return true;
}
