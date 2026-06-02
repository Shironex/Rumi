import { useState } from "react";
import type { CoolifyContext } from "../config.ts";
import type { ActionId, LifecycleAction } from "../coolify/actions.ts";
import { CoolifyClient } from "../coolify/client.ts";
import type { CoolifyResource } from "../coolify/types.ts";

const USE_MOCK = process.env.KANRISHA_MOCK === "1";

export interface PendingAction {
  resource: CoolifyResource;
  id: ActionId;
  /** Imperative label for the modal, e.g. "Restart". */
  verb: string;
}

export interface ActionsApi {
  pending: PendingAction | null;
  busy: boolean;
  error: string | null;
  request: (resource: CoolifyResource, id: ActionId) => void;
  confirm: () => void;
  cancel: () => void;
}

function verbOf(id: ActionId): string {
  return id.charAt(0).toUpperCase() + id.slice(1);
}

/** Called after a successful action; deploymentUuid is set when a build was queued. */
type OnDone = (resource: CoolifyResource, id: ActionId, deploymentUuid?: string) => void;

/** Owns the confirm-then-execute flow for state-changing actions. */
export function useActions(ctx: CoolifyContext | undefined, onDone: OnDone): ActionsApi {
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const request = (resource: CoolifyResource, id: ActionId) => {
    setError(null);
    setPending({ resource, id, verb: verbOf(id) });
  };

  const cancel = () => {
    if (busy) return; // don't abandon a modal while its request is in flight
    setPending(null);
    setError(null);
  };

  const confirm = () => {
    if (!pending || busy) return;
    const { resource, id } = pending;
    if (!USE_MOCK && !ctx) {
      setError("No active context.");
      return;
    }
    setBusy(true);
    setError(null);
    void (async () => {
      try {
        let deploymentUuid: string | undefined;
        if (!USE_MOCK && ctx) {
          const client = new CoolifyClient(ctx);
          deploymentUuid =
            id === "deploy" ? await client.deploy(resource.uuid) : await client.runAction(resource, id as LifecycleAction);
        }
        setBusy(false);
        setPending(null);
        onDone(resource, id, deploymentUuid);
      } catch (err) {
        setBusy(false);
        setError((err as Error).message);
      }
    })();
  };

  return { pending, busy, error, request, confirm, cancel };
}
