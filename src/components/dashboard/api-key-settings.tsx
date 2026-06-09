"use client";

import { useEffect, useState } from "react";
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
  const { keys, updateKeys, isConnected } = useApiKeys();
  const [draft, setDraft] = useState<ApiKeys>({});
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (open) {
      setDraft({});
    }
  }, [open, keys]);

  function handleSave(provider: Provider) {
    const value = draft[provider]?.trim();
    if (!value) return;
    updateKeys({ ...keys, [provider]: value });
    setDraft((prev) => ({ ...prev, [provider]: "" }));
  }

  function handleClear(provider: Provider) {
    const next = { ...keys };
    delete next[provider];
    updateKeys(next);
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
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
            Keys are stored locally in your browser and never sent to any server
            except the respective AI provider.
          </p>
        </div>

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
                      {connected ? "connected" : "not set"}
                    </Badge>
                  </div>

                  {savedKey && (
                    <p className="font-mono text-xs text-muted-foreground">
                      {maskApiKey(savedKey)}
                    </p>
                  )}

                  <Input
                    id={`key-${provider.id}`}
                    type="password"
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
