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
