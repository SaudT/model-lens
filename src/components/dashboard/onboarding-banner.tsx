"use client";

import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { dismissOnboarding } from "@/lib/onboarding";

type OnboardingBannerProps = {
  onDismiss: () => void;
};

export function OnboardingBanner({ onDismiss }: OnboardingBannerProps) {
  function handleDismiss() {
    dismissOnboarding();
    onDismiss();
  }

  return (
    <div className="flex items-start gap-3 border-b border-sky-500/20 bg-sky-500/10 px-8 py-3 text-sm text-sky-950 dark:text-sky-100">
      <p className="flex-1">
        Add your API keys in Settings to unlock Model Comparison. Token Analyzer
        and Cost Calculator work without any keys.
      </p>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 w-7 shrink-0 p-0 text-sky-900 hover:bg-sky-500/20 dark:text-sky-100"
        onClick={handleDismiss}
        aria-label="Dismiss onboarding banner"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
