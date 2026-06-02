import { useRef, useState } from "react";

export interface ToastState {
  text: string;
  tone: "ok" | "warn";
}

export interface ToastApi {
  toast: ToastState | null;
  show: (text: string, tone?: ToastState["tone"]) => void;
}

/** A single auto-dismissing toast. Calling show() again replaces it and resets the timer. */
export function useToast(ttlMs = 2600): ToastApi {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = (text: string, tone: ToastState["tone"] = "ok") => {
    setToast({ text, tone });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), ttlMs);
  };

  return { toast, show };
}
