const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

const DEFAULT_MAX_TOKENS = 4000;

type ChoiceMessage = {
  content?: unknown;
  reasoning?: unknown;
  refusal?: unknown;
};

type OpenRouterPayload = {
  error?: { message?: string };
  choices?: Array<{
    finish_reason?: string;
    message?: ChoiceMessage;
  }>;
};

export async function completeWithOpenRouter(
  prompt: string,
  maxTokens = readMaxTokens(),
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("Server is missing OPENROUTER_API_KEY.");
  }

  const model = process.env.OPENROUTER_MODEL || "nvidia/nemotron-3-ultra-550b-a55b:free";
  let budget = Math.max(800, Math.min(maxTokens, 8000));

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.OPENROUTER_SITE_URL || "http://localhost:3000",
        "X-Title": "Paper Gen",
      },
      body: JSON.stringify({
        model,
        temperature: 0.1,
        max_tokens: budget,
        ...(usesReasoning(model) ? { reasoning: { max_tokens: 256, exclude: true } } : {}),
        ...(model.includes("deepseek") ? { provider: { sort: "price" } } : {}),
        messages: [
          {
            role: "system",
            content:
              "University examiner. Follow the user prompt. Write the full text under each heading it names. Do not stop after the headings.",
          },
          { role: "user", content: prompt },
        ],
      }),
    });

    const payload = (await response.json().catch(() => null)) as OpenRouterPayload | null;

    if (!response.ok) {
      const detail = payload?.error?.message || `OpenRouter request failed (${response.status}).`;
      const affordable = affordableTokens(detail);
      if (affordable && attempt === 0) {
        budget = Math.max(800, Math.min(affordable - 50, budget));
        continue;
      }
      if (/in-flight/i.test(detail)) {
        throw new Error(
          "OpenRouter is still holding credit from a request that has not finished. Wait about a minute, then generate once. Do not click Generate twice.",
        );
      }
      if (/prompt tokens limit exceeded/i.test(detail)) {
        throw new Error(
          "The uploaded paper is a bit large for the remaining OpenRouter prompt budget. The app now uses a shorter prompt — try Generate once more. If it still fails, add a little credit.",
        );
      }
      if (/more credits|max_tokens|can only afford/i.test(detail)) {
        throw new Error(
          "OpenRouter credit is too low for this request. Generation now uses a smaller token cap. Try again, or add a little credit on OpenRouter.",
        );
      }
      throw new Error(detail);
    }

    const choice = payload?.choices?.[0];
    const content = messageText(choice?.message);
    if (content) return content;

    if (choice?.finish_reason === "length" && attempt === 0) {
      budget = Math.min(8000, budget + 2000);
      continue;
    }

    throw new Error(
      "The free model returned no paper text (it may have used all tokens on thinking). Wait a moment and click Generate once.",
    );
  }

  throw new Error("The model returned an empty response. Try again.");
}

function messageText(message: ChoiceMessage | undefined): string {
  if (!message) return "";
  const fromContent = asText(message.content);
  if (fromContent) return fromContent;
  return asText(message.reasoning);
}

function asText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) {
    return value
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object" && "text" in part) return String((part as { text?: unknown }).text || "");
        return "";
      })
      .join("")
      .trim();
  }
  return "";
}

function usesReasoning(model: string): boolean {
  return /nemotron|deepseek-r1/i.test(model);
}

function readMaxTokens(): number {
  const raw = Number(process.env.OPENROUTER_MAX_TOKENS);
  if (Number.isFinite(raw) && raw > 0) return Math.floor(raw);
  return DEFAULT_MAX_TOKENS;
}

function affordableTokens(message: string): number | null {
  const match = message.match(/can only afford (\d+)/i);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}
