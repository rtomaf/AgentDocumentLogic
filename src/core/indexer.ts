import type { DocumentIndex, DocumentMeta, Section } from "../types/index.js";
import { countTokens } from "../chunking/token-counter.js";
import { shortHash } from "../utils/hash.js";

const HEADING_REGEX = /^(#{1,6})\s+(.+)$/gm;

function parseMarkdownSections(content: string): Omit<Section, "tokenCount">[] {
  const sections: Omit<Section, "tokenCount">[] = [];
  const matches: { level: number; heading: string; offset: number }[] = [];

  let match: RegExpExecArray | null;
  while ((match = HEADING_REGEX.exec(content)) !== null) {
    matches.push({
      level: match[1].length,
      heading: match[2].trim(),
      offset: match.index,
    });
  }

  if (matches.length === 0) {
    return [{
      id: "s-0",
      index: 0,
      level: 0,
      startOffset: 0,
      endOffset: content.length,
      content,
      children: [],
    }];
  }

  // Content before first heading
  if (matches[0].offset > 0) {
    const preambleContent = content.slice(0, matches[0].offset).trim();
    if (preambleContent.length > 0) {
      sections.push({
        id: "s-0",
        index: 0,
        level: 0,
        startOffset: 0,
        endOffset: matches[0].offset,
        content: preambleContent,
        children: [],
      });
    }
  }

  for (let i = 0; i < matches.length; i++) {
    const current = matches[i];
    const nextOffset = i < matches.length - 1 ? matches[i + 1].offset : content.length;
    const sectionContent = content.slice(current.offset, nextOffset).trim();

    sections.push({
      id: `s-${sections.length}`,
      index: sections.length,
      heading: current.heading,
      level: current.level,
      startOffset: current.offset,
      endOffset: nextOffset,
      content: sectionContent,
      children: [],
    });
  }

  return sections;
}

function parsePlaintextSections(content: string): Omit<Section, "tokenCount">[] {
  const paragraphs = content.split(/\n\n+/).filter((p) => p.trim().length > 0);
  const sections: Omit<Section, "tokenCount">[] = [];
  let offset = 0;

  for (const para of paragraphs) {
    const startOffset = content.indexOf(para, offset);
    const endOffset = startOffset + para.length;
    offset = endOffset;

    sections.push({
      id: `s-${sections.length}`,
      index: sections.length,
      level: 0,
      startOffset,
      endOffset,
      content: para,
      children: [],
    });
  }

  if (sections.length === 0) {
    sections.push({
      id: "s-0",
      index: 0,
      level: 0,
      startOffset: 0,
      endOffset: content.length,
      content,
      children: [],
    });
  }

  return sections;
}

function buildParentChildRelationships(sections: Section[]): void {
  const stack: Section[] = [];

  for (const section of sections) {
    if (section.level === 0) continue;

    while (stack.length > 0 && stack[stack.length - 1].level >= section.level) {
      stack.pop();
    }

    if (stack.length > 0) {
      const parent = stack[stack.length - 1];
      section.parentId = parent.id;
      parent.children.push(section.id);
    }

    stack.push(section);
  }
}

export async function buildIndex(
  content: string,
  meta: DocumentMeta,
): Promise<DocumentIndex> {
  const format = meta.format;
  let rawSections: Omit<Section, "tokenCount">[];

  switch (format) {
    case "markdown":
    case "html":
    case "docx":
      rawSections = parseMarkdownSections(content);
      break;
    case "plaintext":
    case "pdf":
    default:
      rawSections = parsePlaintextSections(content);
      break;
  }

  const sections: Section[] = [];
  let totalTokens = 0;
  let maxLevel = 0;

  for (const raw of rawSections) {
    const tokenCount = await countTokens(raw.content);
    totalTokens += tokenCount;
    if (raw.level > maxLevel) maxLevel = raw.level;

    sections.push({ ...raw, tokenCount });
  }

  buildParentChildRelationships(sections);

  return {
    documentId: shortHash(content),
    meta,
    sections,
    totalTokens,
    treeDepth: maxLevel,
    generatedAt: new Date().toISOString(),
  };
}
