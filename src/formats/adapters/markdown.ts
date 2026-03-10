import { readFile, writeFile } from "node:fs/promises";

export async function readMarkdown(filePath: string): Promise<string> {
  return readFile(filePath, "utf-8");
}

export async function writeMarkdown(filePath: string, content: string): Promise<void> {
  await writeFile(filePath, content, "utf-8");
}
