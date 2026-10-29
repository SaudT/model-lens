export const STORAGE_KEY = "modelLens_keys";
export const PERSISTENCE_KEY = "modelLens_remember_keys";
export type Provider = "anthropic" | "openai" | "gemini";
export type ApiKeys = { anthropic?: string; openai?: string; gemini?: string };
let pageKeys: ApiKeys | null = null;
export function maskApiKey(key: string): string { return key.length <= 8 ? "••••••••" : `${key.slice(0,3)}...${key.slice(-4)}`; }
function clean(value: unknown): ApiKeys {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([key,value]) => ["anthropic","openai","gemini"].includes(key) && typeof value === "string"));
}
export function remembersKeys(): boolean {
  if (typeof window === "undefined") return false;
  try { return localStorage.getItem(PERSISTENCE_KEY) === "1"; } catch { return false; }
}
export function getApiKeys(): ApiKeys {
  if (typeof window === "undefined") return {};
  if (!remembersKeys()) return pageKeys ?? {};
  try { return clean(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}")); } catch { return {}; }
}
export function saveApiKeys(keys: ApiKeys, remember = remembersKeys()): void {
  if (typeof window === "undefined") return;
  const next = clean(keys);
  if (remember) {
    localStorage.setItem(STORAGE_KEY,JSON.stringify(next));
    localStorage.setItem(PERSISTENCE_KEY,"1");
  } else {
    // Disabling persistence removes any old saved keys, including pre-opt-in versions.
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(PERSISTENCE_KEY);
  }
  pageKeys = next;
}
export function getProviderKey(provider: Provider) { return getApiKeys()[provider]; }
export function isProviderConnected(provider: Provider) { return Boolean(getProviderKey(provider)?.trim()); }
