import { readFile, writeFile } from "node:fs/promises";
import mammoth from "mammoth";
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from "docx";

export async function readDocx(filePath: string): Promise<string> {
  const buffer = await readFile(filePath);
  const result = await (mammoth as unknown as { convertToMarkdown: (opts: { buffer: Buffer }) => Promise<{ value: string }> }).convertToMarkdown({ buffer });
  return result.value;
}

const HEADING_MAP: Record<number, (typeof HeadingLevel)[keyof typeof HeadingLevel]> = {
  1: HeadingLevel.HEADING_1,
  2: HeadingLevel.HEADING_2,
  3: HeadingLevel.HEADING_3,
  4: HeadingLevel.HEADING_4,
  5: HeadingLevel.HEADING_5,
  6: HeadingLevel.HEADING_6,
};

function markdownToDocxParagraphs(content: string): Paragraph[] {
  const lines = content.split("\n");
  const paragraphs: Paragraph[] = [];

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      paragraphs.push(
        new Paragraph({
          heading: HEADING_MAP[level] ?? HeadingLevel.HEADING_1,
          children: [new TextRun({ text: headingMatch[2] })],
        }),
      );
    } else if (line.trim().length > 0) {
      const isBold = line.startsWith("**") && line.endsWith("**");
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: isBold ? line.slice(2, -2) : line,
              bold: isBold,
            }),
          ],
        }),
      );
    } else {
      paragraphs.push(new Paragraph({ children: [] }));
    }
  }

  return paragraphs;
}

export async function writeDocx(filePath: string, content: string): Promise<void> {
  const doc = new Document({
    sections: [{
      children: markdownToDocxParagraphs(content),
    }],
  });

  const buffer = await Packer.toBuffer(doc);
  await writeFile(filePath, buffer);
}
