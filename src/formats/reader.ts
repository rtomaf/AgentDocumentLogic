import type { DocumentFormat } from "../types/index.js";
import { FormatError } from "../utils/errors.js";
import { readPlaintext } from "./adapters/plaintext.js";
import { readMarkdown } from "./adapters/markdown.js";
import { readHtml } from "./adapters/html.js";
import { readDocx } from "./adapters/docx.js";
import { readPdf } from "./adapters/pdf.js";

export async function readDocument(filePath: string, format: DocumentFormat): Promise<string> {
  switch (format) {
    case "plaintext":
      return readPlaintext(filePath);
    case "markdown":
      return readMarkdown(filePath);
    case "html":
      return readHtml(filePath);
    case "docx":
      return readDocx(filePath);
    case "pdf":
      return readPdf(filePath);
    default:
      throw new FormatError(`Unsupported read format: ${format}`, format);
  }
}
