"use client";

import { useEffect, useState } from "react";

import { Sidebar, type View } from "./sidebar";
import { OnboardingBanner } from "./onboarding-banner";
import { TokenAnalyzer } from "@/components/views/token-analyzer";
import { ModelComparison } from "@/components/views/model-comparison";
import { CostCalculator } from "@/components/views/cost-calculator";
import { EvalsDashboard } from "@/components/views/evals-dashboard";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useApiKeys } from "@/hooks/use-api-keys";
import { isOnboardingDismissed } from "@/lib/onboarding";

const VIEW_TITLES: Record<View, string> = {
  "token-analyzer": "Token Analyzer",
  "model-comparison": "Model Comparison",
  "cost-calculator": "Cost Calculator",
  "evals-dashboard": "Evals Dashboard",
};

function ViewContent({ view }: { view: View }) {
  switch (view) {
    case "token-analyzer":
      return <TokenAnalyzer />;
    case "model-comparison":
      return <ModelComparison />;
    case "cost-calculator":
      return <CostCalculator />;
    case "evals-dashboard":
      return <EvalsDashboard />;
  }
}

export function Dashboard() {
  const [activeView, setActiveView] = useState<View>("token-analyzer");
  const [showOnboarding, setShowOnboarding] = useState(false);
  const { keys, loaded } = useApiKeys();

  useEffect(() => {
    if (!loaded) return;

    const hasAnyKey = Boolean(
      keys.anthropic?.trim() ||
        keys.openai?.trim() ||
        keys.gemini?.trim()
    );
    const shouldShow = !hasAnyKey && !isOnboardingDismissed();

    setShowOnboarding((prev) => (prev === shouldShow ? prev : shouldShow));
  }, [loaded, keys.anthropic, keys.openai, keys.gemini]);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar activeView={activeView} onViewChange={setActiveView} />
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <header className="flex shrink-0 items-center justify-between border-b px-8 py-4">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">ModelLens</h1>
            <p className="text-sm text-muted-foreground">
              LLM token analytics & model selection tooling
            </p>
          </div>
          <p className="text-sm font-medium text-muted-foreground">
            {VIEW_TITLES[activeView]}
          </p>
        </header>
        {showOnboarding && (
          <OnboardingBanner onDismiss={() => setShowOnboarding(false)} />
        )}
        <ScrollArea className="min-h-0 flex-1">
          <div className="p-8">
            <ViewContent view={activeView} />
          </div>
        </ScrollArea>
      </main>
    </div>
  );
}
