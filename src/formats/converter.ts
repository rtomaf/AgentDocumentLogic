import type { DocumentFormat } from "../types/index.js";
import { readDocument } from "./reader.js";
import { writeDocument } from "./writer.js";

export async function convertDocument(
  inputPath: string,
  inputFormat: DocumentFormat,
  outputPath: string,
  outputFormat: DocumentFormat,
  title?: string,
): Promise<void> {
  const content = await readDocument(inputPath, inputFormat);
  await writeDocument(outputPath, content, outputFormat, title);
}
