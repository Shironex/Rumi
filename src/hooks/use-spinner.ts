import { useEffect, useState } from "react";
import { USE_MOCK } from "../env.ts";

const FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const INTERVAL_MS = 90;

/** A braille spinner frame that advances while `active` (frozen under mock). One shared timer per caller. */
export function useSpinner(active: boolean): string {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!active || USE_MOCK) return;
    const timer = setInterval(() => setIndex((n) => (n + 1) % FRAMES.length), INTERVAL_MS);
    return () => clearInterval(timer);
  }, [active]);

  return FRAMES[index % FRAMES.length] ?? "⠋";
}
