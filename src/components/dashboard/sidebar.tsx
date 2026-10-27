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
  | "extraction-lab"
  | "token-analyzer"
  | "model-comparison"
  | "cost-calculator"
  | "evals-dashboard";

const NAV_ITEMS: { id: View; label: string; icon: React.ElementType }[] = [
  { id: "extraction-lab", label: "Extraction Lab", icon: FlaskConical },
  { id: "token-analyzer", label: "Token Analyzer", icon: ScanSearch },
  { id: "model-comparison", label: "Model Comparison", icon: Layers },
  { id: "cost-calculator", label: "Cost Calculator", icon: Calculator },
  { id: "evals-dashboard", label: "Legacy Evals (Demo)", icon: FlaskConical },
];

interface SidebarProps {
  activeView: View;
  onViewChange: (view: View) => void;
}

export function Sidebar({ activeView, onViewChange }: SidebarProps) {
  return (
    <aside className="flex w-full shrink-0 flex-col border-b bg-card md:h-full md:w-64 md:border-b-0 md:border-r">
      <div className="flex items-center gap-2 px-4 py-3 md:px-6 md:py-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <BarChart3 className="h-4 w-4" />
        </div>
        <div>
          <h1 className="text-sm font-semibold tracking-tight">ModelLens</h1>
          <p className="text-xs text-muted-foreground">Workload evaluation</p>
        </div>
      </div>

      <div className="px-4 pb-2 md:hidden"><ApiKeySettings /></div>
      <Separator />

      <nav aria-label="Tools" className="flex gap-1 overflow-x-auto p-2 md:block md:flex-1 md:space-y-1 md:p-4">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          return (
            <Button
              key={item.id}
              variant={isActive ? "secondary" : "ghost"}
              className={cn(
                "shrink-0 justify-start gap-2 md:w-full",
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

      <div className="hidden space-y-4 p-4 md:block">
        <ProviderStatus />
        <ApiKeySettings />
      </div>
    </aside>
  );
}
