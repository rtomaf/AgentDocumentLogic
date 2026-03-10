import type { Chunk, ChunkingStrategy, DocumentIndex } from "../types/index.js";
import { headingStrategy } from "./strategies/heading-strategy.js";
import { paragraphStrategy } from "./strategies/paragraph-strategy.js";
import { pageStrategy } from "./strategies/page-strategy.js";
import { tokenStrategy } from "./strategies/token-strategy.js";

export async function chunkDocument(
  content: string,
  index: DocumentIndex,
  strategy: ChunkingStrategy,
  tokenBudget: number,
  overlapTokens: number,
): Promise<Chunk[]> {
  switch (strategy) {
    case "heading":
      return headingStrategy(content, index, tokenBudget, overlapTokens);
    case "paragraph":
      return paragraphStrategy(content, index, tokenBudget, overlapTokens);
    case "page":
      return pageStrategy(content, index, tokenBudget, overlapTokens);
    case "token":
      return tokenStrategy(content, index, tokenBudget, overlapTokens);
  }
}
