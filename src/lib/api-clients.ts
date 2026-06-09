import { getProviderKey } from "./api-keys";

export async function tokenizeWithOpenAI(text: string) {
  const apiKey = getProviderKey("openai");
  if (!apiKey) throw new Error("OpenAI API key not set");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: text }],
      max_tokens: 1,
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message ?? "OpenAI request failed");

  return {
    tokens: data.usage?.prompt_tokens ?? 0,
    provider: "OpenAI",
    method: "API tokenization",
  };
}

export async function tokenizeWithAnthropic(text: string) {
  const apiKey = getProviderKey("anthropic");
  if (!apiKey) throw new Error("Anthropic API key not set");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: "claude-3-5-haiku-20241022",
      max_tokens: 1,
      messages: [{ role: "user", content: text }],
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message ?? "Anthropic request failed");

  return {
    tokens: data.usage?.input_tokens ?? 0,
    provider: "Anthropic",
    method: "API tokenization",
  };
}

export async function compareModels(prompt: string) {
  const openaiKey = getProviderKey("openai");
  const anthropicKey = getProviderKey("anthropic");

  if (!openaiKey && !anthropicKey) {
    throw new Error("No API keys configured");
  }

  const tasks: Promise<{
    provider: string;
    model: string;
    response: string;
    latencyMs: number;
    inputTokens?: number;
    outputTokens?: number;
    error?: string;
  }>[] = [];

  if (openaiKey) {
    tasks.push(
      (async () => {
        const start = performance.now();
        try {
          const res = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${openaiKey}`,
            },
            body: JSON.stringify({
              model: "gpt-4o-mini",
              messages: [{ role: "user", content: prompt }],
              max_tokens: 512,
            }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error?.message ?? "Request failed");
          return {
            provider: "OpenAI",
            model: "gpt-4o-mini",
            response: data.choices[0]?.message?.content ?? "",
            latencyMs: Math.round(performance.now() - start),
            inputTokens: data.usage?.prompt_tokens,
            outputTokens: data.usage?.completion_tokens,
          };
        } catch (err) {
          return {
            provider: "OpenAI",
            model: "gpt-4o-mini",
            response: "",
            latencyMs: Math.round(performance.now() - start),
            error: err instanceof Error ? err.message : "Request failed",
          };
        }
      })()
    );
  }

  if (anthropicKey) {
    tasks.push(
      (async () => {
        const start = performance.now();
        try {
          const res = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": anthropicKey,
              "anthropic-version": "2023-06-01",
              "anthropic-dangerous-direct-browser-access": "true",
            },
            body: JSON.stringify({
              model: "claude-3-5-haiku-20241022",
              max_tokens: 512,
              messages: [{ role: "user", content: prompt }],
            }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error?.message ?? "Request failed");
          const text =
            data.content?.[0]?.type === "text" ? data.content[0].text : "";
          return {
            provider: "Anthropic",
            model: "claude-3-5-haiku-20241022",
            response: text,
            latencyMs: Math.round(performance.now() - start),
            inputTokens: data.usage?.input_tokens,
            outputTokens: data.usage?.output_tokens,
          };
        } catch (err) {
          return {
            provider: "Anthropic",
            model: "claude-3-5-haiku-20241022",
            response: "",
            latencyMs: Math.round(performance.now() - start),
            error: err instanceof Error ? err.message : "Request failed",
          };
        }
      })()
    );
  }

  return Promise.all(tasks);
}
