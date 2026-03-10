import { stat } from "node:fs/promises";
import type { PluginConfig } from "../types/config.js";
import { detectFormat } from "../formats/detector.js";
import { readDocument } from "../formats/reader.js";
import { buildIndex } from "../core/indexer.js";
import { countTokens } from "../chunking/token-counter.js";

export interface GetSectionParams {
  documentPath: string;
  sectionId?: string;
  sectionIndex?: number;
  includeOverlap?: boolean;
  overlapTokens?: number;
}

export async function handleGetSection(params: GetSectionParams, config: PluginConfig) {
  const format = await detectFormat(params.documentPath);
  const content = await readDocument(params.documentPath, format);
  const fileStats = await stat(params.documentPath);
  const estimatedTokens = await countTokens(content);

  const meta = {
    path: params.documentPath,
    format,
    sizeBytes: fileStats.size,
    estimatedTokens,
  };

  const index = await buildIndex(content, meta);

  let section;
  if (params.sectionId) {
    section = index.sections.find((s) => s.id === params.sectionId);
  } else if (params.sectionIndex !== undefined) {
    section = index.sections.find((s) => s.index === params.sectionIndex);
  }

  if (!section) {
    return {
      error: `Section not found`,
      availableSections: index.sections.map((s) => ({ id: s.id, index: s.index, heading: s.heading })),
    };
  }

  const result: Record<string, unknown> = {
    section: {
      id: section.id,
      index: section.index,
      heading: section.heading,
      level: section.level,
      tokenCount: section.tokenCount,
      content: section.content,
    },
  };

  if (params.includeOverlap) {
    const overlapChars = Math.floor((params.overlapTokens ?? config.defaultOverlapTokens) * 3.5);

    const prevSection = index.sections.find((s) => s.index === section.index - 1);
    const nextSection = index.sections.find((s) => s.index === section.index + 1);

    result.overlapBefore = prevSection
      ? prevSection.content.slice(-overlapChars)
      : "";
    result.overlapAfter = nextSection
      ? nextSection.content.slice(0, overlapChars)
      : "";
  }

  return result;
}
