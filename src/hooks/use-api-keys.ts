"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { type ApiKeys, type Provider, STORAGE_KEY, saveApiKeys } from "@/lib/api-keys";

function subscribe(listener: () => void) {
  window.addEventListener("modelLens:keys-updated", listener);
  window.addEventListener("storage", listener);
  return () => { window.removeEventListener("modelLens:keys-updated", listener); window.removeEventListener("storage", listener); };
}
function snapshot(): string {
  try { return localStorage.getItem(STORAGE_KEY) ?? "{}"; } catch { return "{}"; }
}
export function useApiKeys() {
  const raw = useSyncExternalStore(subscribe, snapshot, () => null);
  const keys = useMemo<ApiKeys>(() => {
    try {
      const value: unknown = JSON.parse(raw ?? "{}");
      if (!value || typeof value !== "object" || Array.isArray(value)) return {};
      return Object.fromEntries(Object.entries(value).filter(([key, value]) => ["anthropic", "openai", "gemini"].includes(key) && typeof value === "string"));
    } catch { return {}; }
  }, [raw]);
  const updateKeys = useCallback((next: ApiKeys) => {
    saveApiKeys(next);
    window.dispatchEvent(new Event("modelLens:keys-updated"));
  }, []);
  const isConnected = useCallback((provider: Provider) => Boolean(keys[provider]?.trim()), [keys]);
  return { keys, loaded: raw !== null, updateKeys, isConnected };
}
