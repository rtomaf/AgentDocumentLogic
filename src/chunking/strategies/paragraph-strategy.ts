import type { Chunk, DocumentIndex } from "../../types/index.js";
import { countTokens } from "../token-counter.js";

export async function paragraphStrategy(
  content: string,
  index: DocumentIndex,
  tokenBudget: number,
  overlapTokens: number,
): Promise<Chunk[]> {
  const paragraphs = content.split(/\n\n+/);
  const overlapChars = Math.floor(overlapTokens * 3.5);

  const groups: { text: string; startOffset: number; endOffset: number }[][] = [];
  let currentGroup: { text: string; startOffset: number; endOffset: number }[] = [];
  let currentTokens = 0;
  let offset = 0;

  for (const para of paragraphs) {
    const paraTokens = await countTokens(para);
    const startOffset = content.indexOf(para, offset);
    const endOffset = startOffset + para.length;
    offset = endOffset;

    if (currentGroup.length > 0 && currentTokens + paraTokens > tokenBudget) {
      groups.push(currentGroup);
      currentGroup = [{ text: para, startOffset, endOffset }];
      currentTokens = paraTokens;
    } else {
      currentGroup.push({ text: para, startOffset, endOffset });
      currentTokens += paraTokens;
    }
  }

  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }

  const chunks: Chunk[] = [];

  for (let i = 0; i < groups.length; i++) {
    const group = groups[i];
    const startOff = group[0].startOffset;
    const endOff = group[group.length - 1].endOffset;
    const chunkContent = content.slice(startOff, endOff);

    const overlapBefore = i > 0
      ? content.slice(Math.max(0, startOff - overlapChars), startOff)
      : "";
    const overlapAfter = i < groups.length - 1
      ? content.slice(endOff, Math.min(content.length, endOff + overlapChars))
      : "";

    const sectionIds = index.sections
      .filter((s) => s.startOffset < endOff && s.endOffset > startOff)
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
  }

  for (const chunk of chunks) {
    chunk.totalChunks = chunks.length;
  }

  return chunks;
}
