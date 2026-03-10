import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import type { DocumentFormat } from "../types/index.js";
import { FormatError } from "../utils/errors.js";

const EXTENSION_MAP: Record<string, DocumentFormat> = {
  ".txt": "plaintext",
  ".text": "plaintext",
  ".md": "markdown",
  ".markdown": "markdown",
  ".docx": "docx",
  ".pdf": "pdf",
  ".html": "html",
  ".htm": "html",
};

export function detectFormatFromExtension(filePath: string): DocumentFormat | null {
  const ext = extname(filePath).toLowerCase();
  return EXTENSION_MAP[ext] ?? null;
}

export async function detectFormatFromContent(filePath: string): Promise<DocumentFormat | null> {
  try {
    const buffer = Buffer.alloc(8);
    const fileBuffer = await readFile(filePath);
    fileBuffer.copy(buffer, 0, 0, Math.min(8, fileBuffer.length));

    // PDF: starts with %PDF
    if (buffer.toString("ascii", 0, 4) === "%PDF") return "pdf";

    // DOCX: ZIP archive (starts with PK)
    if (buffer[0] === 0x50 && buffer[1] === 0x4b) return "docx";

    // HTML: starts with < or <!
    const textStart = fileBuffer.toString("utf-8", 0, Math.min(256, fileBuffer.length)).trimStart();
    if (textStart.startsWith("<!DOCTYPE") || textStart.startsWith("<html") || textStart.startsWith("<HTML")) {
      return "html";
    }

    // Markdown: check for common markers
    if (textStart.startsWith("# ") || textStart.startsWith("## ") || textStart.includes("\n# ")) {
      return "markdown";
    }

    return "plaintext";
  } catch {
    return null;
  }
}

export async function detectFormat(filePath: string): Promise<DocumentFormat> {
  const fromExt = detectFormatFromExtension(filePath);
  if (fromExt) return fromExt;

  const fromContent = await detectFormatFromContent(filePath);
  if (fromContent) return fromContent;

  throw new FormatError(`Cannot detect format for: ${filePath}`, "unknown");
}
