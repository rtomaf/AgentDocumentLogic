import { readFile, writeFile } from "node:fs/promises";
import pdfParse from "pdf-parse";
import PDFDocument from "pdfkit";

export async function readPdf(filePath: string): Promise<string> {
  const buffer = await readFile(filePath);
  const data = await pdfParse(buffer);
  return data.text;
}

export async function writePdf(filePath: string, content: string, title?: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 72 });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", async () => {
      try {
        const buffer = Buffer.concat(chunks);
        await writeFile(filePath, buffer);
        resolve();
      } catch (err) {
        reject(err);
      }
    });
    doc.on("error", reject);

    if (title) {
      doc.fontSize(24).font("Helvetica-Bold").text(title, { align: "center" });
      doc.moveDown(2);
    }

    const lines = content.split("\n");
    for (const line of lines) {
      const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
      if (headingMatch) {
        const level = headingMatch[1].length;
        const sizes: Record<number, number> = { 1: 22, 2: 18, 3: 16, 4: 14, 5: 13, 6: 12 };
        doc.fontSize(sizes[level] ?? 12).font("Helvetica-Bold").text(headingMatch[2]);
        doc.moveDown(0.5);
      } else if (line.trim().length === 0) {
        doc.moveDown(0.5);
      } else {
        doc.fontSize(11).font("Helvetica").text(line);
      }
    }

    doc.end();
  });
}
