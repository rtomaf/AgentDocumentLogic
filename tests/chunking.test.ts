import { describe, it, expect } from "vitest";
import { tokenStrategy } from "../src/chunking/strategies/token-strategy.js";
import { headingStrategy } from "../src/chunking/strategies/heading-strategy.js";
import { paragraphStrategy } from "../src/chunking/strategies/paragraph-strategy.js";
import type { DocumentIndex, DocumentMeta } from "../src/types/index.js";
import { buildIndex } from "../src/core/indexer.js";

function makeMeta(content: string): DocumentMeta {
  return {
    path: "/test/doc.md",
    format: "markdown",
    sizeBytes: content.length,
    estimatedTokens: Math.ceil(content.length / 3.5),
  };
}

async function makeIndex(content: string): Promise<DocumentIndex> {
  return buildIndex(content, makeMeta(content));
}

describe("token-strategy", () => {
  it("returns single chunk for small content", async () => {
    const content = "Hello world. This is a short document.";
    const index = await makeIndex(content);
    const chunks = await tokenStrategy(content, index, 50000, 500);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).toBe(content);
    expect(chunks[0].overlapBefore).toBe("");
    expect(chunks[0].overlapAfter).toBe("");
  });

  it("splits large content into multiple chunks", async () => {
    const paragraph = "This is a paragraph with enough text to be meaningful. ".repeat(100);
    const content = Array.from({ length: 20 }, () => paragraph).join("\n\n");
    const index = await makeIndex(content);
    const chunks = await tokenStrategy(content, index, 5000, 100);
    expect(chunks.length).toBeGreaterThan(1);

    // Verify no gaps
    let totalContent = "";
    for (const chunk of chunks) {
      totalContent += chunk.content;
    }
    expect(totalContent.length).toBe(content.length);
  });

  it("includes overlap context", async () => {
    const paragraph = "Sentence one. Sentence two. Sentence three. ".repeat(200);
    const content = Array.from({ length: 10 }, () => paragraph).join("\n\n");
    const index = await makeIndex(content);
    const chunks = await tokenStrategy(content, index, 5000, 200);

    if (chunks.length > 1) {
      expect(chunks[1].overlapBefore.length).toBeGreaterThan(0);
      expect(chunks[0].overlapAfter.length).toBeGreaterThan(0);
    }
  });
});

describe("heading-strategy", () => {
  it("splits by headings", async () => {
    const content = [
      "# Introduction",
      "This is the intro.",
      "",
      "# Background",
      "This is background info.",
      "",
      "# Methods",
      "This is the methods section.",
    ].join("\n");

    const index = await makeIndex(content);
    const chunks = await headingStrategy(content, index, 50000, 100);
    expect(chunks.length).toBeGreaterThanOrEqual(1);
  });

  it("merges small sections", async () => {
    const content = [
      "# A",
      "Short.",
      "",
      "# B",
      "Short.",
      "",
      "# C",
      "Short.",
    ].join("\n");

    const index = await makeIndex(content);
    const chunks = await headingStrategy(content, index, 50000, 100);
    // Should merge all into one chunk since they're all tiny
    expect(chunks).toHaveLength(1);
  });
});

describe("paragraph-strategy", () => {
  it("groups paragraphs within budget", async () => {
    const paragraphs = Array.from({ length: 5 }, (_, i) => `Paragraph ${i + 1}. This is content.`);
    const content = paragraphs.join("\n\n");
    const index = await makeIndex(content);
    const chunks = await paragraphStrategy(content, index, 50000, 100);
    expect(chunks).toHaveLength(1);
  });
});
