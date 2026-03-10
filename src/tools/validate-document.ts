import { stat } from "node:fs/promises";
import type { PluginConfig } from "../types/config.js";
import { detectFormat } from "../formats/detector.js";
import { readDocument } from "../formats/reader.js";
import { buildIndex } from "../core/indexer.js";
import { countTokens } from "../chunking/token-counter.js";

export interface ValidateDocumentParams {
  path: string;
  checks?: string[];
}

interface ValidationIssue {
  severity: "error" | "warning" | "info";
  check: string;
  message: string;
  location?: string;
}

export async function handleValidateDocument(params: ValidateDocumentParams, _config: PluginConfig) {
  const checks = params.checks ?? ["structure", "encoding", "references", "format"];
  const issues: ValidationIssue[] = [];

  const format = await detectFormat(params.path);
  const content = await readDocument(params.path, format);
  const fileStats = await stat(params.path);
  const estimatedTokens = await countTokens(content);

  const meta = { path: params.path, format, sizeBytes: fileStats.size, estimatedTokens };

  // Structure check
  if (checks.includes("structure")) {
    const index = await buildIndex(content, meta);

    if (index.sections.length === 0) {
      issues.push({ severity: "warning", check: "structure", message: "Document has no detectable sections" });
    }

    // Check for empty sections
    for (const section of index.sections) {
      if (section.content.trim().length === 0) {
        issues.push({
          severity: "warning",
          check: "structure",
          message: `Empty section: ${section.heading ?? section.id}`,
          location: `section ${section.id}`,
        });
      }
    }

    // Check for heading level jumps (e.g., h1 -> h3 without h2)
    for (let i = 1; i < index.sections.length; i++) {
      const prev = index.sections[i - 1];
      const curr = index.sections[i];
      if (prev.level > 0 && curr.level > 0 && curr.level > prev.level + 1) {
        issues.push({
          severity: "warning",
          check: "structure",
          message: `Heading level jump: h${prev.level} -> h${curr.level}`,
          location: `section ${curr.id}`,
        });
      }
    }
  }

  // Encoding check
  if (checks.includes("encoding")) {
    const hasNullBytes = content.includes("\0");
    if (hasNullBytes) {
      issues.push({ severity: "error", check: "encoding", message: "Document contains null bytes" });
    }

    // Check for BOM
    if (content.charCodeAt(0) === 0xfeff) {
      issues.push({ severity: "info", check: "encoding", message: "Document has UTF-8 BOM" });
    }
  }

  // References check (for Markdown)
  if (checks.includes("references") && (format === "markdown" || format === "html")) {
    // Check for broken internal links
    const linkRefs = content.match(/\[([^\]]+)\]\(#([^)]+)\)/g) ?? [];
    const headingIds = content.match(/^#{1,6}\s+(.+)$/gm)?.map((h) =>
      h.replace(/^#+\s+/, "").toLowerCase().replace(/\s+/g, "-").replace(/[^\w-]/g, ""),
    ) ?? [];

    for (const link of linkRefs) {
      const targetMatch = link.match(/\(#([^)]+)\)/);
      if (targetMatch && !headingIds.includes(targetMatch[1])) {
        issues.push({
          severity: "warning",
          check: "references",
          message: `Broken internal link: #${targetMatch[1]}`,
        });
      }
    }
  }

  // Format compliance
  if (checks.includes("format")) {
    if (content.trim().length === 0) {
      issues.push({ severity: "error", check: "format", message: "Document is empty" });
    }

    if (format === "markdown") {
      // Check for trailing whitespace (common issue)
      const trailingWS = content.split("\n").filter((l) => l !== l.trimEnd()).length;
      if (trailingWS > 10) {
        issues.push({
          severity: "info",
          check: "format",
          message: `${trailingWS} lines have trailing whitespace`,
        });
      }
    }
  }

  return {
    valid: issues.filter((i) => i.severity === "error").length === 0,
    format,
    sizeBytes: fileStats.size,
    estimatedTokens,
    issueCount: issues.length,
    issues,
  };
}
