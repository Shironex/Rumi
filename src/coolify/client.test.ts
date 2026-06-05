import { afterEach, expect, test } from "bun:test";
import type { CoolifyContext } from "../config.ts";
import { CoolifyApiError, CoolifyClient } from "./client.ts";
import type { CoolifyResource, EnvWrite } from "./types.ts";

const ctx: CoolifyContext = { name: "t", fqdn: "https://x.test", token: "tok", default: true };

const app: CoolifyResource = {
  uuid: "APPUUID",
  name: "api",
  rawType: "application",
  kind: "application",
  status: "running:healthy",
  state: "running",
  meta: {},
};

const payload: EnvWrite = {
  key: "FOO",
  value: "bar",
  is_preview: false,
  is_build_time: true,
  is_literal: false,
  is_multiline: false,
  is_shown_once: false,
};

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

/** Capture the single request a client call makes, returning a chosen Response. */
function stubFetch(response: Response): { calls: Array<{ url: string; init: RequestInit }> } {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  globalThis.fetch = (async (url: string | URL, init: RequestInit = {}) => {
    calls.push({ url: String(url), init });
    return response;
  }) as typeof fetch;
  return { calls };
}

test("updateEnvVar PATCHes /envs with auth + JSON body", async () => {
  const { calls } = stubFetch(new Response("{}", { status: 200 }));
  await new CoolifyClient(ctx).updateEnvVar(app, payload);

  expect(calls).toHaveLength(1);
  const { url, init } = calls[0]!;
  const headers = init.headers as Record<string, string>;
  expect(url).toBe("https://x.test/api/v1/applications/APPUUID/envs");
  expect(init.method).toBe("PATCH");
  expect(headers["Content-Type"]).toBe("application/json");
  expect(headers["Authorization"]).toBe("Bearer tok");
  expect(JSON.parse(init.body as string)).toEqual(payload);
});

test("createEnvVar POSTs to the same /envs collection", async () => {
  const { calls } = stubFetch(new Response("{}", { status: 201 }));
  await new CoolifyClient(ctx).createEnvVar(app, payload);

  const { url, init } = calls[0]!;
  expect(url).toBe("https://x.test/api/v1/applications/APPUUID/envs");
  expect(init.method).toBe("POST");
  expect(JSON.parse(init.body as string)).toEqual(payload);
});

test("deleteEnvVar DELETEs by env uuid with no body and survives a 204", async () => {
  const { calls } = stubFetch(new Response(null, { status: 204 }));
  await new CoolifyClient(ctx).deleteEnvVar(app, "ENVUUID");

  const { url, init } = calls[0]!;
  const headers = init.headers as Record<string, string>;
  expect(url).toBe("https://x.test/api/v1/applications/APPUUID/envs/ENVUUID");
  expect(init.method).toBe("DELETE");
  expect(init.body).toBeUndefined();
  expect(headers["Content-Type"]).toBeUndefined();
  expect(headers["Authorization"]).toBe("Bearer tok");
});

test("deleteEnvVar refuses when the env uuid is missing", () => {
  stubFetch(new Response("{}", { status: 200 }));
  expect(new CoolifyClient(ctx).deleteEnvVar(app, "")).rejects.toThrow(/uuid is missing/);
});

test("a non-2xx write surfaces a CoolifyApiError", () => {
  stubFetch(new Response("forbidden", { status: 403 }));
  expect(new CoolifyClient(ctx).updateEnvVar(app, payload)).rejects.toBeInstanceOf(CoolifyApiError);
});
