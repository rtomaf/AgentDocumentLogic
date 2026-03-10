import type { Chunk, DocumentIndex, Section } from "../../types/index.js";
import { countTokens } from "../token-counter.js";

function mergeSections(sections: Section[], budget: number): Section[][] {
  const groups: Section[][] = [];
  let currentGroup: Section[] = [];
  let currentTokens = 0;

  for (const section of sections) {
    if (currentGroup.length > 0 && currentTokens + section.tokenCount > budget) {
      groups.push(currentGroup);
      currentGroup = [section];
      currentTokens = section.tokenCount;
    } else {
      currentGroup.push(section);
      currentTokens += section.tokenCount;
    }
  }

  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }

  return groups;
}

export async function headingStrategy(
  content: string,
  index: DocumentIndex,
  tokenBudget: number,
  overlapTokens: number,
): Promise<Chunk[]> {
  const sections = index.sections;
  if (sections.length === 0) {
    return [{
      sectionIds: [],
      content,
      tokenCount: await countTokens(content),
      overlapBefore: "",
      overlapAfter: "",
      chunkIndex: 0,
      totalChunks: 1,
    }];
  }

  const groups = mergeSections(sections, tokenBudget);
  const overlapChars = Math.floor(overlapTokens * 3.5);
  const chunks: Chunk[] = [];

  for (let i = 0; i < groups.length; i++) {
    const group = groups[i];
    const startOffset = group[0].startOffset;
    const endOffset = group[group.length - 1].endOffset;
    const chunkContent = content.slice(startOffset, endOffset);

    const overlapBefore = i > 0
      ? content.slice(Math.max(0, startOffset - overlapChars), startOffset)
      : "";
    const overlapAfter = i < groups.length - 1
      ? content.slice(endOffset, Math.min(content.length, endOffset + overlapChars))
      : "";

    chunks.push({
      sectionIds: group.map((s) => s.id),
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
