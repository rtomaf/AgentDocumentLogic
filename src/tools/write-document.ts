import type { PluginConfig } from "../types/config.js";
import type { DocumentFormat } from "../types/index.js";
import { detectFormatFromExtension } from "../formats/detector.js";
import { writeDocument } from "../formats/writer.js";
import { stat } from "node:fs/promises";

export interface WriteDocumentParams {
  path: string;
  content: string;
  format?: DocumentFormat;
  title?: string;
}

export async function handleWriteDocument(params: WriteDocumentParams, _config: PluginConfig) {
  const format = params.format ?? detectFormatFromExtension(params.path) ?? "plaintext";
  await writeDocument(params.path, params.content, format, params.title);

  const fileStats = await stat(params.path);

  return {
    path: params.path,
    format,
    sizeBytes: fileStats.size,
  };
}
