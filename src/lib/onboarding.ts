export const ONBOARDING_DISMISSED_KEY = "modelLens_onboarding_dismissed";

export function isOnboardingDismissed(): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(ONBOARDING_DISMISSED_KEY) === "true";
}

export function dismissOnboarding(): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(ONBOARDING_DISMISSED_KEY, "true");
}
