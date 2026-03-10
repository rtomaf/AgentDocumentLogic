import OpenAI from "openai";
import { createLogger } from "../utils/logger.js";
import { LLMError } from "../utils/errors.js";

const log = createLogger("llm-provider");

export class LLMProvider {
  private client: OpenAI;
  private model = "gpt-5.4";

  constructor(
    apiKey: string,
    private reasoningEffort: string = "medium",
  ) {
    this.client = new OpenAI({ apiKey });
  }

  async complete(
    systemPrompt: string,
    userPrompt: string,
    options?: {
      maxTokens?: number;
      temperature?: number;
      responseFormat?: "text" | "json_object";
    },
  ): Promise<string> {
    try {
      log.debug("LLM request", {
        model: this.model,
        reasoningEffort: this.reasoningEffort,
        systemLen: systemPrompt.length,
        userLen: userPrompt.length,
      });

      const response = await this.client.chat.completions.create({
        model: this.model,
        reasoning_effort: this.reasoningEffort as "low" | "medium" | "high",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_completion_tokens: options?.maxTokens ?? 16384,
        temperature: options?.temperature ?? 0.3,
        stream: false,
        response_format: options?.responseFormat
          ? { type: options.responseFormat }
          : undefined,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      const content = (response as OpenAI.Chat.ChatCompletion).choices[0]?.message?.content ?? "";

      log.debug("LLM response", {
        outputLen: content.length,
        finishReason: (response as OpenAI.Chat.ChatCompletion).choices[0]?.finish_reason,
      });

      return content;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      const statusCode = (error as { status?: number }).status;
      const retryable = statusCode === 429 || statusCode === 503 || statusCode === 529;

      throw new LLMError(
        `GPT-5.4 call failed: ${err.message}`,
        statusCode,
        retryable,
      );
    }
  }
}
