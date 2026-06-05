import { expect, test } from "bun:test";
import { type EnvVar, envCreatePayload, envFileBlock, envUpdatePayload, parseEnvAssignment } from "./types.ts";

function env(key: string, value?: string, overrides: Partial<EnvVar> = {}): EnvVar {
  return {
    uuid: "",
    key,
    value,
    buildtime: false,
    runtime: false,
    required: false,
    shared: false,
    preview: false,
    multiline: false,
    literal: false,
    shownOnce: false,
    managed: false,
    ...overrides,
  };
}

/**
 * Reverse envFileBlock's quoting so we can assert round-trip fidelity instead of
 * hand-computing brittle golden strings. Mirrors a standard `.env` parser: a
 * double-quoted value is unwrapped and its backslash escapes are decoded.
 */
function parseEnvLine(line: string): [string, string] {
  const eq = line.indexOf("=");
  const key = line.slice(0, eq);
  const raw = line.slice(eq + 1);
  if (!(raw.startsWith('"') && raw.endsWith('"') && raw.length >= 2)) return [key, raw];
  const inner = raw.slice(1, -1);
  let out = "";
  for (let i = 0; i < inner.length; i++) {
    if (inner[i] === "\\" && i + 1 < inner.length) {
      const n = inner[++i];
      out += n === "n" ? "\n" : n === "r" ? "\r" : n === "t" ? "\t" : n;
    } else {
      out += inner[i];
    }
  }
  return [key, out];
}

test("envFileBlock round-trips values that need escaping", () => {
  const cases: Record<string, string> = {
    PLAIN: "hello",
    URL: "https://example.com/path?a=1&b=2",
    BACKSLASH: "C:\\Users\\me",
    NEWLINE: "line1\nline2",
    QUOTE: 'say "hi"',
    HASH: "value#notcomment",
    SPACES: "  padded  ",
    DOLLAR: "$HOME/bin",
    BACKSLASH_THEN_N: "C:\\new", // literal backslash + 'n', must NOT become a newline
    EMPTY: "",
    UNICODE: "café—𝕏",
  };
  const envs = Object.entries(cases).map(([k, v]) => env(k, v));
  const block = envFileBlock(envs);

  const parsed = Object.fromEntries(block.split("\n").map(parseEnvLine));
  expect(parsed).toEqual(cases);
});

test("envFileBlock skips vars whose value is hidden", () => {
  const block = envFileBlock([env("VISIBLE", "x"), env("HIDDEN", undefined), env("ALSO", "y")]);
  expect(block).toBe("VISIBLE=x\nALSO=y");
});

test("envFileBlock leaves bare values unquoted", () => {
  expect(envFileBlock([env("K", "plainvalue")])).toBe("K=plainvalue");
  expect(envFileBlock([env("K", "")])).toBe("K=");
});

test("envFileBlock returns empty string for no readable vars", () => {
  expect(envFileBlock([env("A", undefined)])).toBe("");
  expect(envFileBlock([])).toBe("");
});

test("parseEnvAssignment splits on the first = and validates the key", () => {
  expect(parseEnvAssignment("FOO=bar")).toEqual({ key: "FOO", value: "bar" });
  expect(parseEnvAssignment("URL=https://x/y?a=1&b=2")).toEqual({ key: "URL", value: "https://x/y?a=1&b=2" });
  expect(parseEnvAssignment("  SPACED  = trimmed key, kept value ")).toEqual({
    key: "SPACED",
    value: " trimmed key, kept value ",
  });
  expect(parseEnvAssignment("EMPTY=")).toEqual({ key: "EMPTY", value: "" });
});

test("parseEnvAssignment rejects missing or invalid keys", () => {
  expect(parseEnvAssignment("noequals")).toBeNull();
  expect(parseEnvAssignment("=novalue")).toBeNull();
  expect(parseEnvAssignment("9LEADINGDIGIT=x")).toBeNull();
  expect(parseEnvAssignment("has space=x")).toBeNull();
  expect(parseEnvAssignment("dash-key=x")).toBeNull();
});

test("envUpdatePayload carries every flag over so PATCH can't reset them", () => {
  const e = env("SECRET", "old", {
    buildtime: true,
    runtime: false,
    preview: true,
    literal: true,
    multiline: true,
    shownOnce: true,
  });
  expect(envUpdatePayload(e, "new")).toEqual({
    key: "SECRET",
    value: "new",
    is_buildtime: true,
    is_runtime: false,
    is_preview: true,
    is_literal: true,
    is_multiline: true,
    is_shown_once: true,
  });
});

test("envCreatePayload is runtime-by-default and infers multiline", () => {
  expect(envCreatePayload("K", "v")).toEqual({
    key: "K",
    value: "v",
    is_buildtime: false,
    is_runtime: true,
    is_preview: false,
    is_literal: false,
    is_multiline: false,
    is_shown_once: false,
  });
  expect(envCreatePayload("K", "a\nb").is_multiline).toBe(true);
});
