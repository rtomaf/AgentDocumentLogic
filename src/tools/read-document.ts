import { stat } from "node:fs/promises";
import type { PluginConfig } from "../types/config.js";
import { detectFormat } from "../formats/detector.js";
import { readDocument } from "../formats/reader.js";
import { buildIndex } from "../core/indexer.js";
import { countTokens } from "../chunking/token-counter.js";

export interface ReadDocumentParams {
  path: string;
  sectionId?: string;
  chunkIndex?: number;
  includeContent?: boolean;
}

export async function handleReadDocument(params: ReadDocumentParams, _config: PluginConfig) {
  const format = await detectFormat(params.path);
  const fileStats = await stat(params.path);
  const content = await readDocument(params.path, format);
  const estimatedTokens = await countTokens(content);

  const meta = {
    path: params.path,
    format,
    sizeBytes: fileStats.size,
    estimatedTokens,
  };

  const index = await buildIndex(content, meta);

  // Return specific section if requested
  if (params.sectionId) {
    const section = index.sections.find((s) => s.id === params.sectionId);
    if (!section) {
      return { error: `Section ${params.sectionId} not found`, meta, sectionCount: index.sections.length };
    }
    return { meta, section };
  }

  // Decide whether to include full content
  const shouldInclude = params.includeContent ?? estimatedTokens < 30000;

  return {
    meta,
    totalTokens: index.totalTokens,
    sectionCount: index.sections.length,
    treeDepth: index.treeDepth,
    sections: index.sections.map((s) => ({
      id: s.id,
      heading: s.heading,
      level: s.level,
      tokenCount: s.tokenCount,
    })),
    content: shouldInclude ? content : undefined,
    note: shouldInclude ? undefined : `Document has ${estimatedTokens} tokens. Use sectionId to read specific sections, or set includeContent=true to force full read.`,
  };
}
