export type ApiErrorKind = "invalid_key" | "rate_limit" | "network" | "unknown";

export const API_ERROR_MESSAGES: Record<ApiErrorKind, string> = {
  invalid_key: "Invalid API key — verify your key in Settings and try again.",
  rate_limit: "Rate limit exceeded — wait a moment before retrying.",
  network: "Network error — check your connection and try again.",
  unknown: "Request failed — an unexpected error occurred.",
};

export function classifyApiError(
  message: string,
  status?: number
): { kind: ApiErrorKind; message: string } {
  const lower = message.toLowerCase();

  if (
    status === 401 ||
    status === 403 ||
    /invalid.*api.*key|incorrect api key|authentication|unauthorized|invalid x-api-key|invalid_api_key|permission denied|api key not valid/i.test(
      lower
    )
  ) {
    return { kind: "invalid_key", message: API_ERROR_MESSAGES.invalid_key };
  }

  if (
    status === 429 ||
    /rate limit|too many requests|overloaded|quota exceeded|requests per minute/i.test(
      lower
    )
  ) {
    return { kind: "rate_limit", message: API_ERROR_MESSAGES.rate_limit };
  }

  if (
    /fetch failed|network error|network request failed|econnrefused|etimedout|timeout|failed to fetch|dns/i.test(
      lower
    )
  ) {
    return { kind: "network", message: API_ERROR_MESSAGES.network };
  }

  return {
    kind: "unknown",
    message: message.trim() || API_ERROR_MESSAGES.unknown,
  };
}

export function classifyThrownError(
  err: unknown,
  status?: number
): { kind: ApiErrorKind; message: string } {
  if (err instanceof TypeError) {
    return classifyApiError(err.message || "fetch failed", status);
  }
  if (err instanceof Error) {
    return classifyApiError(err.message, status);
  }
  return classifyApiError(String(err), status);
}
