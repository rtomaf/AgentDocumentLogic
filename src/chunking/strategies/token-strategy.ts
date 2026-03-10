import type { Chunk, DocumentIndex } from "../../types/index.js";
import { countTokens } from "../token-counter.js";

function findSentenceBoundary(text: string, targetPos: number, scanBack: number): number {
  const searchStart = Math.max(0, targetPos - scanBack);
  const region = text.slice(searchStart, targetPos);
  const sentenceEnders = /[.!?]\s/g;
  let lastMatch = -1;
  let match: RegExpExecArray | null;
  while ((match = sentenceEnders.exec(region)) !== null) {
    lastMatch = searchStart + match.index + match[0].length;
  }
  return lastMatch;
}

function findParagraphBoundary(text: string, targetPos: number, scanBack: number): number {
  const searchStart = Math.max(0, targetPos - scanBack);
  const region = text.slice(searchStart, targetPos);
  const lastDoubleNewline = region.lastIndexOf("\n\n");
  if (lastDoubleNewline === -1) return -1;
  return searchStart + lastDoubleNewline + 2;
}

export async function tokenStrategy(
  content: string,
  _index: DocumentIndex,
  tokenBudget: number,
  overlapTokens: number,
): Promise<Chunk[]> {
  const totalTokens = await countTokens(content);
  if (totalTokens <= tokenBudget) {
    return [{
      sectionIds: _index.sections.map((s) => s.id),
      content,
      tokenCount: totalTokens,
      overlapBefore: "",
      overlapAfter: "",
      chunkIndex: 0,
      totalChunks: 1,
    }];
  }

  const chunks: Chunk[] = [];
  let position = 0;
  const minChunkChars = Math.floor((tokenBudget * 3.5) * 0.1);
  const budgetChars = Math.floor(tokenBudget * 3.5);
  const overlapChars = Math.floor(overlapTokens * 3.5);

  while (position < content.length) {
    let endTarget = position + budgetChars;

    if (endTarget >= content.length) {
      endTarget = content.length;
    } else {
      let boundary = findSentenceBoundary(content, endTarget, Math.floor(budgetChars * 0.15));
      if (boundary === -1 || boundary <= position + minChunkChars) {
        boundary = findParagraphBoundary(content, endTarget, Math.floor(budgetChars * 0.3));
      }
      if (boundary !== -1 && boundary > position + minChunkChars) {
        endTarget = boundary;
      }
    }

    const chunkContent = content.slice(position, endTarget);
    const overlapBefore = position > 0 ? content.slice(Math.max(0, position - overlapChars), position) : "";
    const overlapAfter = endTarget < content.length ? content.slice(endTarget, Math.min(content.length, endTarget + overlapChars)) : "";

    const sectionIds = _index.sections
      .filter((s) => s.startOffset < endTarget && s.endOffset > position)
      .map((s) => s.id);

    chunks.push({
      sectionIds,
      content: chunkContent,
      tokenCount: await countTokens(chunkContent),
      overlapBefore,
      overlapAfter,
      chunkIndex: chunks.length,
      totalChunks: 0,
    });

    position = endTarget;
  }

  for (const chunk of chunks) {
    chunk.totalChunks = chunks.length;
  }

  return chunks;
}
