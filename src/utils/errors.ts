import type { OperationPhase } from "../types/index.js";

export class DocumentProcessingError extends Error {
  constructor(
    message: string,
    public phase: OperationPhase,
    public operationId?: string,
  ) {
    super(message);
    this.name = "DocumentProcessingError";
  }
}

export class FormatError extends DocumentProcessingError {
  constructor(
    message: string,
    public format: string,
  ) {
    super(message, "intake");
    this.name = "FormatError";
  }
}

export class ChunkingError extends DocumentProcessingError {
  constructor(
    message: string,
    public sectionId: string,
  ) {
    super(message, "decompose");
    this.name = "ChunkingError";
  }
}

export class LLMError extends DocumentProcessingError {
  constructor(
    message: string,
    public statusCode?: number,
    public retryable: boolean = false,
  ) {
    super(message, "execute");
    this.name = "LLMError";
  }
}

export class AssemblyError extends DocumentProcessingError {
  constructor(
    message: string,
    public missingSections: string[],
  ) {
    super(message, "assemble");
    this.name = "AssemblyError";
  }
}

export class StateError extends DocumentProcessingError {
  constructor(message: string, operationId?: string) {
    super(message, "intake", operationId);
    this.name = "StateError";
  }
}

export function isRetryableError(error: unknown): boolean {
  if (error instanceof LLMError) return error.retryable;
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return msg.includes("rate limit") || msg.includes("timeout") || msg.includes("503") || msg.includes("529");
  }
  return false;
}
