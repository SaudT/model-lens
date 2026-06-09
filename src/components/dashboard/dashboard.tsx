"use client";

import { useState } from "react";

import { Sidebar, type View } from "./sidebar";
import { TokenAnalyzer } from "@/components/views/token-analyzer";
import { ModelComparison } from "@/components/views/model-comparison";
import { CostCalculator } from "@/components/views/cost-calculator";
import { ScrollArea } from "@/components/ui/scroll-area";

const VIEW_TITLES: Record<View, string> = {
  "token-analyzer": "Token Analyzer",
  "model-comparison": "Model Comparison",
  "cost-calculator": "Cost Calculator",
};

function ViewContent({ view }: { view: View }) {
  switch (view) {
    case "token-analyzer":
      return <TokenAnalyzer />;
    case "model-comparison":
      return <ModelComparison />;
    case "cost-calculator":
      return <CostCalculator />;
  }
}

export function Dashboard() {
  const [activeView, setActiveView] = useState<View>("token-analyzer");

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar activeView={activeView} onViewChange={setActiveView} />
      <main className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center border-b px-8">
          <h2 className="text-sm font-medium text-muted-foreground">
            {VIEW_TITLES[activeView]}
          </h2>
        </header>
        <ScrollArea className="flex-1">
          <div className="p-8">
            <ViewContent view={activeView} />
          </div>
        </ScrollArea>
      </main>
    </div>
  );
}
