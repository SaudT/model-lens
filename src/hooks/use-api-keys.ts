"use client";

import { useCallback, useEffect, useState } from "react";
import {
  type ApiKeys,
  type Provider,
  getApiKeys,
  saveApiKeys,
} from "@/lib/api-keys";

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
      setKeys(getApiKeys());
    }
    window.addEventListener("modelLens:keys-updated", handleKeysUpdated);
    return () =>
      window.removeEventListener("modelLens:keys-updated", handleKeysUpdated);
  }, []);

  return { keys, loaded, updateKeys, isConnected };
}
