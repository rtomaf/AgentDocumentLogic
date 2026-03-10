import type { PluginConfig } from "../types/config.js";
import { detectFormat } from "../formats/detector.js";
import { readDocument } from "../formats/reader.js";
import { writeDocument } from "../formats/writer.js";
import { buildIndex } from "../core/indexer.js";
import { countTokens } from "../chunking/token-counter.js";
import { stat } from "node:fs/promises";

export interface EditSectionParams {
  documentPath: string;
  sectionId: string;
  newContent: string;
  preserveHeading?: boolean;
}

export async function handleEditSection(params: EditSectionParams, _config: PluginConfig) {
  const format = await detectFormat(params.documentPath);
  const content = await readDocument(params.documentPath, format);
  const fileStats = await stat(params.documentPath);
  const meta = {
    path: params.documentPath,
    format,
    sizeBytes: fileStats.size,
    estimatedTokens: await countTokens(content),
  };

  const index = await buildIndex(content, meta);
  const section = index.sections.find((s) => s.id === params.sectionId);

  if (!section) {
    return { error: `Section ${params.sectionId} not found`, availableSections: index.sections.map((s) => s.id) };
  }

  const previousTokenCount = section.tokenCount;
  let replacement = params.newContent;

  if (params.preserveHeading !== false && section.heading) {
    const headingLine = content.slice(section.startOffset).split("\n")[0];
    if (!replacement.startsWith(headingLine)) {
      replacement = `${headingLine}\n\n${replacement}`;
    }
  }

  // Ensure proper boundary: replacement should end with \n\n before next section
  if (!replacement.endsWith("\n\n")) {
    replacement = replacement.replace(/\n*$/, "\n\n");
  }

  const newContent = content.slice(0, section.startOffset) + replacement + content.slice(section.endOffset);
  await writeDocument(params.documentPath, newContent, format);

  const newTokenCount = await countTokens(replacement);

  return {
    success: true,
    sectionId: params.sectionId,
    previousTokenCount,
    newTokenCount,
  };
}
