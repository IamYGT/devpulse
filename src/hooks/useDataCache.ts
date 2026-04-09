import { useState, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";

interface CacheEntry<T> { data: T; timestamp: number; }

export function useDataCache<T>(command: string, args?: Record<string, unknown>, ttlMs = 5000) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cacheRef = useRef<CacheEntry<T> | null>(null);

  const fetch = useCallback(async (force = false) => {
    const now = Date.now();
    if (!force && cacheRef.current && (now - cacheRef.current.timestamp < ttlMs)) {
      setData(cacheRef.current.data);
      return cacheRef.current.data;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await invoke<T>(command, args || {});
      cacheRef.current = { data: result, timestamp: now };
      setData(result);
      setLoading(false);
      return result;
    } catch (e) {
      setError(String(e));
      setLoading(false);
      return null;
    }
  }, [command, JSON.stringify(args), ttlMs]);

  return { data, loading, error, fetch, invalidate: () => { cacheRef.current = null; } };
}
