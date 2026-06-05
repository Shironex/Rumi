import { expect, test } from "bun:test";
import { osc52 } from "./clipboard.ts";

test("osc52 wraps base64 in the clipboard escape", () => {
  const b64 = Buffer.from("hello").toString("base64");
  expect(osc52("hello", false)).toBe(`\x1b]52;c;${b64}\x07`);
});

test("osc52 base64-encodes unicode via Buffer (not btoa)", () => {
  const text = "café—𝕏";
  const b64 = Buffer.from(text, "utf8").toString("base64");
  expect(osc52(text, false)).toBe(`\x1b]52;c;${b64}\x07`);
});

test("osc52 wraps in a tmux passthrough with doubled ESC inside tmux", () => {
  const seq = osc52("hi", true);
  expect(seq.startsWith("\x1bPtmux;")).toBe(true);
  expect(seq.endsWith("\x1b\\")).toBe(true);
  // The inner OSC 52's ESC must be doubled so tmux forwards it to the outer term.
  expect(seq).toContain("\x1b\x1b]52;c;");
});
