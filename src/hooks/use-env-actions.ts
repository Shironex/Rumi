import { useState } from "react";
import type { CoolifyContext } from "../config.ts";
import { CoolifyClient } from "../coolify/client.ts";
import { type CoolifyResource, type EnvVar, envCreatePayload, envUpdatePayload } from "../coolify/types.ts";
import { USE_MOCK } from "../env.ts";

export interface EnvActionsApi {
  busy: boolean;
  error: string | null;
  clearError: () => void;
  /** Each resolves true on success (caller closes the modal), false on failure. */
  update: (env: EnvVar, value: string) => Promise<boolean>;
  create: (key: string, value: string) => Promise<boolean>;
  remove: (env: EnvVar) => Promise<boolean>;
}

/** Called after a successful write with a short summary, e.g. "FOO updated". */
type OnDone = (summary: string) => void;

/**
 * Owns the in-flight state for env writes (update / create / delete). Mirrors
 * {@link useActions}: a single busy/error pair, mock-mode short-circuits the
 * network. Coolify applies env changes on the next deploy, not immediately — the
 * caller's onDone surfaces that.
 */
export function useEnvActions(
  ctx: CoolifyContext | undefined,
  resource: CoolifyResource | undefined,
  onDone: OnDone,
): EnvActionsApi {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (work: (client: CoolifyClient) => Promise<void>, summary: string): Promise<boolean> => {
    if (busy) return false;
    if (!resource) {
      setError("No resource selected.");
      return false;
    }
    if (!USE_MOCK && !ctx) {
      setError("No active context.");
      return false;
    }
    setBusy(true);
    setError(null);
    try {
      if (!USE_MOCK && ctx) await work(new CoolifyClient(ctx));
      setBusy(false);
      onDone(summary);
      return true;
    } catch (err) {
      setBusy(false);
      setError((err as Error).message);
      return false;
    }
  };

  return {
    busy,
    error,
    clearError: () => setError(null),
    update: (env, value) => run((c) => c.updateEnvVar(resource!, envUpdatePayload(env, value)), `${env.key} updated`),
    create: (key, value) => run((c) => c.createEnvVar(resource!, envCreatePayload(key, value)), `${key} added`),
    remove: (env) => run((c) => c.deleteEnvVar(resource!, env.uuid), `${env.key} deleted`),
  };
}
