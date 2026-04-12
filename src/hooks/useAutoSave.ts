import { useRef, useCallback, useEffect, useState } from "react";

export function useAutoSave(
  saveFunction: () => Promise<void>,
  debounceMs: number = 500
) {
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerSave = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setSaveStatus("saving");
    timerRef.current = setTimeout(async () => {
      await saveFunction();
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    }, debounceMs);
  }, [saveFunction, debounceMs]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { triggerSave, saveStatus };
}
