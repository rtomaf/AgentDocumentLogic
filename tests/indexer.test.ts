import { describe, it, expect } from "vitest";
import { buildIndex } from "../src/core/indexer.js";
import type { DocumentMeta } from "../src/types/index.js";

function makeMeta(content: string, format: DocumentMeta["format"] = "markdown"): DocumentMeta {
  return {
    path: "/test/doc.md",
    format,
    sizeBytes: content.length,
    estimatedTokens: Math.ceil(content.length / 3.5),
  };
}

describe("indexer", () => {
  it("parses markdown headings into sections", async () => {
    const content = [
      "# Title",
      "Intro text.",
      "",
      "## Section One",
      "Content one.",
      "",
      "## Section Two",
      "Content two.",
      "",
      "### Subsection",
      "Sub content.",
    ].join("\n");

    const index = await buildIndex(content, makeMeta(content));

    expect(index.sections.length).toBe(4);
    expect(index.sections[0].heading).toBe("Title");
    expect(index.sections[0].level).toBe(1);
    expect(index.sections[1].heading).toBe("Section One");
    expect(index.sections[1].level).toBe(2);
    expect(index.sections[2].heading).toBe("Section Two");
    expect(index.sections[2].level).toBe(2);
    expect(index.sections[3].heading).toBe("Subsection");
    expect(index.sections[3].level).toBe(3);
  });

  it("handles document with no headings", async () => {
    const content = "Just plain text.\n\nAnother paragraph.";
    const index = await buildIndex(content, makeMeta(content));

    expect(index.sections.length).toBeGreaterThanOrEqual(1);
  });

  it("handles plaintext format", async () => {
    const content = "First paragraph.\n\nSecond paragraph.\n\nThird paragraph.";
    const index = await buildIndex(content, makeMeta(content, "plaintext"));

    expect(index.sections.length).toBe(3);
    expect(index.sections[0].content).toBe("First paragraph.");
    expect(index.sections[1].content).toBe("Second paragraph.");
  });

  it("builds parent-child relationships", async () => {
    const content = [
      "# Parent",
      "Parent content.",
      "",
      "## Child",
      "Child content.",
    ].join("\n");

    const index = await buildIndex(content, makeMeta(content));

    const parent = index.sections.find((s) => s.heading === "Parent");
    const child = index.sections.find((s) => s.heading === "Child");

    expect(parent).toBeDefined();
    expect(child).toBeDefined();
    expect(child!.parentId).toBe(parent!.id);
    expect(parent!.children).toContain(child!.id);
  });

  it("computes token counts", async () => {
    const content = "# Title\nSome content with words.";
    const index = await buildIndex(content, makeMeta(content));

    expect(index.totalTokens).toBeGreaterThan(0);
    for (const section of index.sections) {
      expect(section.tokenCount).toBeGreaterThan(0);
    }
  });

  it("generates a document ID", async () => {
    const content = "# Test\nContent.";
    const index = await buildIndex(content, makeMeta(content));

    expect(index.documentId).toBeTruthy();
    expect(index.documentId.length).toBe(12);
  });

  it("records timestamp", async () => {
    const content = "# Test\nContent.";
    const index = await buildIndex(content, makeMeta(content));

    expect(index.generatedAt).toBeTruthy();
    expect(new Date(index.generatedAt).getTime()).toBeGreaterThan(0);
  });
});
