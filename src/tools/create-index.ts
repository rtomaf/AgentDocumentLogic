import { stat } from "node:fs/promises";
import type { PluginConfig } from "../types/config.js";
import { detectFormat } from "../formats/detector.js";
import { readDocument } from "../formats/reader.js";
import { buildIndex } from "../core/indexer.js";
import { countTokens } from "../chunking/token-counter.js";

export interface CreateIndexParams {
  path: string;
}

export async function handleCreateIndex(params: CreateIndexParams, _config: PluginConfig) {
  const format = await detectFormat(params.path);
  const content = await readDocument(params.path, format);
  const fileStats = await stat(params.path);
  const estimatedTokens = await countTokens(content);

  const meta = {
    path: params.path,
    format,
    sizeBytes: fileStats.size,
    estimatedTokens,
  };

  const index = await buildIndex(content, meta);

  return {
    documentId: index.documentId,
    meta: index.meta,
    totalTokens: index.totalTokens,
    treeDepth: index.treeDepth,
    sectionCount: index.sections.length,
    sections: index.sections.map((s) => ({
      id: s.id,
      index: s.index,
      heading: s.heading,
      level: s.level,
      tokenCount: s.tokenCount,
      children: s.children,
      parentId: s.parentId,
    })),
    generatedAt: index.generatedAt,
  };
}
