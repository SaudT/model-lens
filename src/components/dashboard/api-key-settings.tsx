"use client";

import { useState } from "react";
import { AlertTriangle, KeyRound } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import {
  type ApiKeys,
  type Provider,
  maskApiKey,
} from "@/lib/api-keys";
import { useApiKeys } from "@/hooks/use-api-keys";
import { cn } from "@/lib/utils";

const PROVIDERS: {
  id: Provider;
  label: string;
  placeholder: string;
}[] = [
  { id: "anthropic", label: "Anthropic", placeholder: "sk-ant-..." },
  { id: "openai", label: "OpenAI", placeholder: "sk-..." },
  { id: "gemini", label: "Google Gemini", placeholder: "AIza..." },
];

export function ApiKeySettings() {
  const { keys, updateKeys, isConnected, remember, setRemember } = useApiKeys();
  const [storageError, setStorageError] = useState("");
  const [draft, setDraft] = useState<ApiKeys>({});
  const [open, setOpen] = useState(false);

  function handleSave(provider: Provider) {
    const value = draft[provider]?.trim();
    if (!value) return;
    try { updateKeys({ ...keys, [provider]: value }); setStorageError(""); } catch { setStorageError("Cannot save keys. Check browser storage permissions."); return; }
    setDraft((prev) => ({ ...prev, [provider]: "" }));
  }

  function handleClear(provider: Provider) {
    const next = { ...keys };
    delete next[provider];
    try { updateKeys(next); setStorageError(""); } catch { setStorageError("Cannot clear stored keys. Check browser storage permissions."); }
  }

  return (
    <Sheet open={open} onOpenChange={(next) => { if (next) setDraft({}); setOpen(next); }}>
      <SheetTrigger asChild>
        <Button variant="outline" className="w-full justify-start gap-2">
          <KeyRound className="h-4 w-4" />
          API Key Settings
        </Button>
      </SheetTrigger>
      <SheetContent className="overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>API Key Settings</SheetTitle>
          <SheetDescription>
            Configure provider API keys for Model Lens tools.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <p>
            Keys stay in page memory by default and clear on reload. Hosted calls
            pass through the ModelLens server to your selected provider. Keys
            are not stored in a server database or included in experiment exports.
            Provider billing and data policies apply.
          </p>
        </div>

        <label className="mt-4 flex items-start gap-2 text-sm"><input type="checkbox" checked={remember} onChange={e => { try { setRemember(e.target.checked); setStorageError(""); } catch { setStorageError("Cannot change key storage. Check browser permissions."); } }}/><span>Remember keys on this device (localStorage). Leave off on shared computers.</span></label>
        {storageError && <p role="alert" className="mt-2 text-sm text-red-700">{storageError}</p>}
        <ol className="mt-4 list-inside list-decimal space-y-1 text-xs text-muted-foreground"><li>Create an API key in the provider console below. A chat subscription does not necessarily include API credit.</li><li>Paste it and choose Save. Saving does not call the API or verify the key.</li><li>Select a model in Extraction Lab, review the charge notice, and run the experiment.</li></ol>
        <div className="mt-6 space-y-6">
          {PROVIDERS.map((provider, index) => {
            const savedKey = keys[provider.id];
            const connected = isConnected(provider.id);

            return (
              <div key={provider.id}>
                {index > 0 && <Separator className="mb-6" />}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor={`key-${provider.id}`}>
                      {provider.label}
                    </Label>
                    <Badge variant={connected ? "success" : "danger"}>
                      {connected ? (remember ? "saved · unverified" : "page session · unverified") : "not set"}
                    </Badge>
                  </div>

                  <a className="text-xs underline" href={provider.id === "openai" ? "https://platform.openai.com/api-keys" : provider.id === "anthropic" ? "https://console.anthropic.com/settings/keys" : "https://aistudio.google.com/apikey"} target="_blank" rel="noreferrer">Get a {provider.label} API key</a>
                  {savedKey && (
                    <p className="font-mono text-xs text-muted-foreground">
                      {maskApiKey(savedKey)}
                    </p>
                  )}

                  <Input
                    id={`key-${provider.id}`}
                    type="password"
                    autoComplete="off"
                    spellCheck={false}
                    placeholder={provider.placeholder}
                    value={draft[provider.id] ?? ""}
                    onChange={(e) =>
                      setDraft((prev) => ({
                        ...prev,
                        [provider.id]: e.target.value,
                      }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSave(provider.id);
                    }}
                  />

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleSave(provider.id)}
                      disabled={!draft[provider.id]?.trim()}
                    >
                      Save
                    </Button>
                    {savedKey && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleClear(provider.id)}
                      >
                        Clear
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function ProviderStatus({ className }: { className?: string }) {
  const { isConnected } = useApiKeys();

  return (
    <div className={cn("space-y-2", className)}>
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        Providers
      </p>
      <div className="flex flex-wrap gap-1.5">
        {PROVIDERS.map((p) => (
          <Badge
            key={p.id}
            variant={isConnected(p.id) ? "success" : "danger"}
            className="text-[10px]"
          >
            {p.label}
          </Badge>
        ))}
      </div>
    </div>
  );
}
