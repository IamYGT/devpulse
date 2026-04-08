import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useInterval } from "./useInterval";

export interface PomodoroState {
  mode: "work" | "short_break" | "long_break" | "idle";
  remaining_seconds: number;
  sessions_completed: number;
  is_running: boolean;
  work_duration: number;
  short_break_duration: number;
  long_break_duration: number;
  long_break_interval: number;
}

export function usePomodoroState(intervalMs = 1000) {
  const [state, setState] = useState<PomodoroState | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  const fetchState = useCallback(async () => {
    try {
      // Tick the backend timer by 1 second
      const msg = await invoke<string | null>("tick_pomodoro", {
        elapsedSecs: 1,
      });
      if (msg) {
        setNotification(msg);
        // Clear notification after 5 seconds
        setTimeout(() => setNotification(null), 5000);
      }

      const result = await invoke<PomodoroState>("get_pomodoro_state");
      setState(result);
    } catch (err) {
      console.error("Failed to fetch pomodoro state:", err);
    }
  }, []);

  useInterval(fetchState, intervalMs);

  return { state, notification };
}
