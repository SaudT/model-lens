"use client";

import { useState } from "react";

import { Sidebar, type View } from "./sidebar";
import { ExtractionLab } from "@/components/views/extraction-lab";
import { TokenAnalyzer } from "@/components/views/token-analyzer";
import { ModelComparison } from "@/components/views/model-comparison";
import { CostCalculator } from "@/components/views/cost-calculator";
import { EvalsDashboard } from "@/components/views/evals-dashboard";
import { ScrollArea } from "@/components/ui/scroll-area";

const VIEW_TITLES: Record<View, string> = {
  "extraction-lab": "Extraction Lab",
  "token-analyzer": "Token Analyzer",
  "model-comparison": "Model Comparison",
  "cost-calculator": "Cost Calculator",
  "evals-dashboard": "Legacy Evals (Demo)",
};

function ViewContent({ view }: { view: View }) {
  switch (view) {
    case "extraction-lab":
      return <ExtractionLab />;
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
  const [activeView, setActiveView] = useState<View>("extraction-lab");
  const [visited, setVisited] = useState<View[]>(["extraction-lab"]);
  function changeView(view: View) {
    setVisited(previous => previous.includes(view) ? previous : [...previous, view]);
    setActiveView(view);
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden md:flex-row">
      <Sidebar activeView={activeView} onViewChange={changeView} />
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <header className="flex shrink-0 items-center justify-between border-b px-4 py-4 md:px-8">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">ModelLens</h1>
            <p className="text-sm text-muted-foreground">
              Measure extraction quality, inspect failures, choose a model
            </p>
          </div>
          <p className="text-sm font-medium text-muted-foreground">
            {VIEW_TITLES[activeView]}
          </p>
        </header>
        <ScrollArea className="min-h-0 flex-1">
          <div className="p-4 md:p-8">
            {visited.map(view => <div key={view} hidden={view !== activeView}><ViewContent view={view} /></div>)}
          </div>
        </ScrollArea>
      </main>
    </div>
  );
}
