import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useInterval } from "./useInterval";
import type { TrackerState } from "../types";

export function useTrackerState(intervalMs = 1000) {
  const [state, setState] = useState<TrackerState | null>(null);

  const fetchState = useCallback(async () => {
    try {
      const result = await invoke<TrackerState>("get_current_state");
      setState(result);
    } catch (err) {
      console.error("Failed to fetch tracker state:", err);
    }
  }, []);

  useInterval(fetchState, intervalMs);

  return state;
}
