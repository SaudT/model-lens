export const STORAGE_KEY = "modelLens_keys";

export type Provider = "anthropic" | "openai" | "gemini";

export type ApiKeys = {
  anthropic?: string;
  openai?: string;
  gemini?: string;
};

export function maskApiKey(key: string): string {
  if (key.length <= 8) return "••••••••";
  const prefix = key.slice(0, 3);
  const suffix = key.slice(-4);
  return `${prefix}...${suffix}`;
}

export function getApiKeys(): ApiKeys {
  if (typeof window === "undefined") return {};
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return {};
    return JSON.parse(stored) as ApiKeys;
  } catch {
    return {};
  }
}

export function saveApiKeys(keys: ApiKeys): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
}

export function getProviderKey(provider: Provider): string | undefined {
  return getApiKeys()[provider];
}

export function isProviderConnected(provider: Provider): boolean {
  const key = getProviderKey(provider);
  return Boolean(key && key.trim().length > 0);
}
