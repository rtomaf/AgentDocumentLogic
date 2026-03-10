import type { Chunk, DocumentIndex } from "../../types/index.js";
import { countTokens } from "../token-counter.js";

const PAGE_BREAK_MARKERS = ["\f", "\x0c", "--- PAGE BREAK ---"];

function splitByPages(content: string): string[] {
  for (const marker of PAGE_BREAK_MARKERS) {
    if (content.includes(marker)) {
      return content.split(marker).filter((p) => p.trim().length > 0);
    }
  }
  // Fallback: treat each ~3000 chars as a "page"
  const pageSize = 3000;
  const pages: string[] = [];
  for (let i = 0; i < content.length; i += pageSize) {
    pages.push(content.slice(i, i + pageSize));
  }
  return pages;
}

export async function pageStrategy(
  content: string,
  index: DocumentIndex,
  tokenBudget: number,
  overlapTokens: number,
): Promise<Chunk[]> {
  const pages = splitByPages(content);
  const overlapChars = Math.floor(overlapTokens * 3.5);

  const groups: { text: string; startOffset: number; endOffset: number }[][] = [];
  let currentGroup: { text: string; startOffset: number; endOffset: number }[] = [];
  let currentTokens = 0;
  let offset = 0;

  for (const page of pages) {
    const pageTokens = await countTokens(page);
    const startOffset = offset;
    const endOffset = offset + page.length;
    offset = endOffset;

    if (currentGroup.length > 0 && currentTokens + pageTokens > tokenBudget) {
      groups.push(currentGroup);
      currentGroup = [{ text: page, startOffset, endOffset }];
      currentTokens = pageTokens;
    } else {
      currentGroup.push({ text: page, startOffset, endOffset });
      currentTokens += pageTokens;
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
    const chunkContent = group.map((g) => g.text).join("\n\n");

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
