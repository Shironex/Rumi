import type { CoolifyResource, ResourceKind, ResourceState } from "./types.ts";

/** Lifecycle verbs Coolify's REST API accepts on a resource. */
export type LifecycleAction = "start" | "stop" | "restart";

/** Everything the user can trigger from the table. `deploy` is its own endpoint. */
export type ActionId = LifecycleAction | "deploy";

/** REST path segment per kind; null = no lifecycle endpoint (unknown types). */
export function actionSegment(kind: ResourceKind): string | null {
  switch (kind) {
    case "application":
      return "applications";
    case "service":
      return "services";
    case "database":
      return "databases";
    default:
      return null;
  }
}

/** A start/stop toggle: anything not already stopped should stop, else start. */
export function toggleVerb(state: ResourceState): "start" | "stop" {
  return state === "stopped" ? "start" : "stop";
}

/** Deploy only makes sense for git/compose resources, not standalone databases. */
export function canDeploy(resource: CoolifyResource): boolean {
  return resource.kind === "application" || resource.kind === "service";
}

/** True when the resource kind has any lifecycle endpoint at all. */
export function canAct(resource: CoolifyResource): boolean {
  return actionSegment(resource.kind) !== null;
}
