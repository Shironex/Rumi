import { USE_MOCK } from "./env.ts";

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** True for a single visible character (letters, digits, space, punctuation). */
export function isPrintable(ch: string, ctrl: boolean, meta: boolean): boolean {
  return ch.length === 1 && !ctrl && !meta && ch.charCodeAt(0) >= 32;
}

/** True when a thrown error is a fetch abort — the signal was aborted or fetch threw AbortError. */
export function isAbortError(err: unknown, signal?: AbortSignal): boolean {
  return Boolean(signal?.aborted) || (err as Error | undefined)?.name === "AbortError";
}

/** Time of day for freshness labels. Mock runs use UTC and skip the system locale, so captures match everywhere. */
export function formatClock(ts: number): string {
  const d = new Date(ts);
  return USE_MOCK ? d.toISOString().slice(11, 19) : d.toLocaleTimeString();
}

/** Date and time for detail rows, with the same mock rule as formatClock. */
export function formatDateTime(d: Date): string {
  return USE_MOCK ? d.toISOString().slice(0, 19).replace("T", " ") : d.toLocaleString();
}
