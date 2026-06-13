"use client";

import { useCallback, useEffect, useState } from "react";
import {
  type ApiKeys,
  type Provider,
  getApiKeys,
  saveApiKeys,
} from "@/lib/api-keys";

function keysEqual(a: ApiKeys, b: ApiKeys): boolean {
  return (
    (a.anthropic ?? "") === (b.anthropic ?? "") &&
    (a.openai ?? "") === (b.openai ?? "") &&
    (a.gemini ?? "") === (b.gemini ?? "")
  );
}

export function useApiKeys() {
  const [keys, setKeys] = useState<ApiKeys>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setKeys(getApiKeys());
    setLoaded(true);
  }, []);

  const updateKeys = useCallback((next: ApiKeys) => {
    saveApiKeys(next);
    setKeys(next);
    window.dispatchEvent(new CustomEvent("modelLens:keys-updated"));
  }, []);

  const isConnected = useCallback(
    (provider: Provider) => Boolean(keys[provider]?.trim()),
    [keys]
  );

  useEffect(() => {
    function handleKeysUpdated() {
      setKeys((prev) => {
        const next = getApiKeys();
        return keysEqual(prev, next) ? prev : next;
      });
    }
    window.addEventListener("modelLens:keys-updated", handleKeysUpdated);
    return () =>
      window.removeEventListener("modelLens:keys-updated", handleKeysUpdated);
  }, []);

  return { keys, loaded, updateKeys, isConnected };
}
