import { useEffect, useState } from "react";
import type { CoolifyContext } from "../config.ts";
import { CoolifyClient } from "../coolify/client.ts";
import { mockConfig, mockEnvVars } from "../coolify/mock.ts";
import type { ConfigField, CoolifyResource, EnvVar } from "../coolify/types.ts";

const USE_MOCK = process.env.KANRISHA_MOCK === "1";

export interface ConfigState {
  config: ConfigField[];
  envs: EnvVar[];
  /** True once at least one env carried a value, i.e. the token can read secrets. */
  valuesAvailable: boolean;
  loading: boolean;
  error: string | null;
  /** False when the resource kind has no config/env endpoint (db / unknown). */
  supported: boolean;
}

const IDLE: ConfigState = { config: [], envs: [], valuesAvailable: false, loading: false, error: null, supported: true };

/**
 * Loads a resource's curated config + env vars once per open (these change rarely,
 * so no polling). Env values are present only with a sensitive-read token; the
 * pane masks them and notes when they're hidden.
 */
export function useConfig(
  ctx: CoolifyContext | undefined,
  resource: CoolifyResource | undefined,
  active: boolean,
): ConfigState {
  const [state, setState] = useState<ConfigState>(IDLE);

  useEffect(() => {
    if (!active || !ctx || !resource) {
      setState(IDLE);
      return;
    }
    if (resource.kind !== "application" && resource.kind !== "service") {
      setState({ ...IDLE, supported: false });
      return;
    }
    if (USE_MOCK) {
      setState({ config: mockConfig(), envs: mockEnvVars(), valuesAvailable: true, loading: false, error: null, supported: true });
      return;
    }

    const controller = new AbortController();
    setState({ config: [], envs: [], valuesAvailable: false, loading: true, error: null, supported: true });

    (async () => {
      try {
        const client = new CoolifyClient(ctx);
        const [config, envs] = await Promise.all([
          client.getConfig(resource, controller.signal),
          client.getEnvVars(resource, controller.signal),
        ]);
        if (controller.signal.aborted) return;
        setState({
          config,
          envs,
          valuesAvailable: envs.some((e) => e.value !== undefined),
          loading: false,
          error: null,
          supported: true,
        });
      } catch (err) {
        if (controller.signal.aborted || (err as Error).name === "AbortError") return;
        setState({ config: [], envs: [], valuesAvailable: false, loading: false, error: (err as Error).message, supported: true });
      }
    })();

    return () => controller.abort();
  }, [active, ctx, resource]);

  return state;
}
