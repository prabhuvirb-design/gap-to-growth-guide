import { createOpenAI } from "@ai-sdk/openai";
import { Output, streamText } from "ai";
import type { z } from "zod";

export class AiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export async function generateStructured<T>(schema: z.ZodType<T>, instructions: string, prompt: string): Promise<T> {
  const apiKey = process.env['LOVABLE_API_KEY'];
  if (!apiKey) throw new AiError("AI is not configured.", 401);
  const provider = createOpenAI({
    baseURL: "https://ai.gateway.lovable.dev/v1",
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
  });
  let failure: unknown;
  const result = streamText({
    model: provider.responses("openai/gpt-6-astra"),
    instructions,
    prompt,
    output: Output.object({ schema }),
    onError: ({ error }) => {
      failure = error;
    },
    providerOptions: {
      openai: {
        forceReasoning: true,
        reasoningEffort: "low",
        reasoningSummary: "auto",
        store: false,
        include: ["reasoning.encrypted_content"],
      },
    },
  });
  try {
    return (await result.output) as T;
  } catch (e) {
    const err = (failure ?? e) as { statusCode?: number; message?: string };
    const status = err?.statusCode ?? 500;
    const msg =
      status === 402
        ? "AI credits are used up. Add credits in Settings → Plans & credits."
        : status === 429
          ? "Too many requests right now — please wait a moment and try again."
          : err?.message || "The AI tutor couldn't respond.";
    throw new AiError(msg, status);
  }
}
