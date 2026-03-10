import type { DocumentFormat } from "../types/index.js";
import { FormatError } from "../utils/errors.js";
import { writePlaintext } from "./adapters/plaintext.js";
import { writeMarkdown } from "./adapters/markdown.js";
import { writeHtml } from "./adapters/html.js";
import { writeDocx } from "./adapters/docx.js";
import { writePdf } from "./adapters/pdf.js";

export async function writeDocument(
  filePath: string,
  content: string,
  format: DocumentFormat,
  title?: string,
): Promise<void> {
  switch (format) {
    case "plaintext":
      return writePlaintext(filePath, content);
    case "markdown":
      return writeMarkdown(filePath, content);
    case "html":
      return writeHtml(filePath, content, title);
    case "docx":
      return writeDocx(filePath, content);
    case "pdf":
      return writePdf(filePath, content, title);
    default:
      throw new FormatError(`Unsupported write format: ${format}`, format);
  }
}
