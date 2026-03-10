import { readFile, writeFile } from "node:fs/promises";
import * as cheerio from "cheerio";
import TurndownService from "turndown";

export async function readHtml(filePath: string): Promise<string> {
  const raw = await readFile(filePath, "utf-8");
  const $ = cheerio.load(raw);

  // Remove scripts and styles
  $("script, style").remove();

  // Extract text from body, or entire document if no body
  const body = $("body").html() ?? $.html();
  const turndown = new TurndownService({ headingStyle: "atx", codeBlockStyle: "fenced" });
  return turndown.turndown(body);
}

export async function writeHtml(filePath: string, content: string, title?: string): Promise<void> {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title ?? "Document"}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 800px; margin: 2rem auto; padding: 0 1rem; line-height: 1.6; }
    pre { background: #f4f4f4; padding: 1rem; overflow-x: auto; }
    code { background: #f4f4f4; padding: 0.2rem 0.4rem; border-radius: 3px; }
  </style>
</head>
<body>
${content}
</body>
</html>`;
  await writeFile(filePath, html, "utf-8");
}
