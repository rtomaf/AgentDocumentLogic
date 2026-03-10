import { createLogger } from "../utils/logger.js";

const log = createLogger("token-counter");

let encoderInstance: { encode: (text: string) => number[]; decode: (tokens: number[]) => string } | null = null;
let initAttempted = false;

async function getEncoder() {
  if (encoderInstance) return encoderInstance;
  if (initAttempted) return null;
  initAttempted = true;

  try {
    const tiktoken = await import("js-tiktoken");
    encoderInstance = tiktoken.encodingForModel("gpt-4o" as Parameters<typeof tiktoken.encodingForModel>[0]);
    log.info("tiktoken encoder loaded (o200k_base)");
    return encoderInstance;
  } catch {
    log.warn("tiktoken not available, falling back to heuristic token counting");
    return null;
  }
}

export async function countTokens(text: string): Promise<number> {
  const encoder = await getEncoder();
  if (encoder) return encoder.encode(text).length;
  return estimateTokens(text);
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3.5);
}

export async function truncateToTokens(text: string, maxTokens: number): Promise<string> {
  const encoder = await getEncoder();
  if (encoder) {
    const tokens = encoder.encode(text);
    if (tokens.length <= maxTokens) return text;
    return encoder.decode(tokens.slice(0, maxTokens));
  }
  const estimatedCharLimit = Math.floor(maxTokens * 3.5);
  return text.slice(0, estimatedCharLimit);
}

export async function tokenize(text: string): Promise<number[]> {
  const encoder = await getEncoder();
  if (encoder) return encoder.encode(text);
  const fakeTokens: number[] = [];
  for (let i = 0; i < text.length; i += 4) {
    fakeTokens.push(i);
  }
  return fakeTokens;
}

export async function detokenize(tokens: number[]): Promise<string> {
  const encoder = await getEncoder();
  if (encoder) return encoder.decode(tokens);
  return "(detokenize unavailable without tiktoken)";
}
