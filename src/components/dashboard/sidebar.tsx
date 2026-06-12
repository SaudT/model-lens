"use client";

import {
  BarChart3,
  Calculator,
  FlaskConical,
  Layers,
  ScanSearch,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ApiKeySettings, ProviderStatus } from "./api-key-settings";
import { cn } from "@/lib/utils";

export type View =
  | "token-analyzer"
  | "model-comparison"
  | "cost-calculator"
  | "evals-dashboard";

const NAV_ITEMS: { id: View; label: string; icon: React.ElementType }[] = [
  { id: "token-analyzer", label: "Token Analyzer", icon: ScanSearch },
  { id: "model-comparison", label: "Model Comparison", icon: Layers },
  { id: "cost-calculator", label: "Cost Calculator", icon: Calculator },
  { id: "evals-dashboard", label: "Evals Dashboard", icon: FlaskConical },
];

interface SidebarProps {
  activeView: View;
  onViewChange: (view: View) => void;
}

export function Sidebar({ activeView, onViewChange }: SidebarProps) {
  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r bg-card">
      <div className="flex items-center gap-2 px-6 py-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <BarChart3 className="h-4 w-4" />
        </div>
        <div>
          <h1 className="text-sm font-semibold tracking-tight">ModelLens</h1>
          <p className="text-xs text-muted-foreground">Token & model tooling</p>
        </div>
      </div>

      <Separator />

      <nav className="flex-1 space-y-1 p-4">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          return (
            <Button
              key={item.id}
              variant={isActive ? "secondary" : "ghost"}
              className={cn(
                "w-full justify-start gap-2",
                isActive && "bg-secondary"
              )}
              onClick={() => onViewChange(item.id)}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Button>
          );
        })}
      </nav>

      <div className="space-y-4 p-4">
        <ProviderStatus />
        <ApiKeySettings />
      </div>
    </aside>
  );
}
