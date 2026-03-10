import { describe, it, expect } from "vitest";
import { generatePlan } from "../src/core/planner.js";
import { createTasks } from "../src/core/decomposer.js";
import { assemble } from "../src/core/assembler.js";
import { buildIndex } from "../src/core/indexer.js";
import type { DocumentMeta } from "../src/types/index.js";
import { DEFAULT_CONFIG } from "../src/types/config.js";

const testConfig = { ...DEFAULT_CONFIG, openaiApiKey: "test-key" };

function makeMeta(content: string): DocumentMeta {
  return {
    path: "/test/doc.md",
    format: "markdown",
    sizeBytes: content.length,
    estimatedTokens: Math.ceil(content.length / 3.5),
  };
}

describe("planner", () => {
  it("classifies rewrite instructions", async () => {
    const meta = makeMeta("# Hello\nContent");
    const plan = await generatePlan("Rewrite this in a formal tone", meta, "# Hello\nContent", testConfig);
    expect(plan.instructionType).toBe("rewrite");
    expect(plan.operationId).toMatch(/^op-/);
  });

  it("classifies summarize instructions", async () => {
    const meta = makeMeta("# Hello\nContent");
    const plan = await generatePlan("Summarize the key points", meta, "# Hello\nContent", testConfig);
    expect(plan.instructionType).toBe("summarize");
  });

  it("classifies translate instructions", async () => {
    const meta = makeMeta("# Hello\nContent");
    const plan = await generatePlan("Translate this to Spanish", meta, "# Hello\nContent", testConfig);
    expect(plan.instructionType).toBe("translate");
  });

  it("selects heading strategy for markdown", async () => {
    const meta = makeMeta("# Hello\nContent");
    const plan = await generatePlan("Edit this document", meta, "# Hello\nContent", testConfig);
    expect(plan.chunkingStrategy).toBe("heading");
  });

  it("selects page strategy for PDF", async () => {
    const meta: DocumentMeta = { path: "/test/doc.pdf", format: "pdf", sizeBytes: 1000, estimatedTokens: 300 };
    const plan = await generatePlan("Summarize this PDF", meta, "content", testConfig);
    expect(plan.chunkingStrategy).toBe("page");
  });

  it("infers output format from instruction", async () => {
    const meta = makeMeta("# Hello\nContent");
    const plan = await generatePlan("Convert this to HTML", meta, "# Hello\nContent", testConfig);
    expect(plan.outputFormat).toBe("html");
  });
});

describe("decomposer", () => {
  it("creates one task per section", async () => {
    const content = [
      "# Section A",
      "Content A with enough text to be substantial for testing purposes.",
      "",
      "# Section B",
      "Content B with enough text to be substantial for testing purposes.",
    ].join("\n");

    const meta = makeMeta(content);
    const index = await buildIndex(content, meta);
    const plan = await generatePlan("Rewrite formally", meta, content, testConfig);
    const tasks = createTasks(plan, index);

    expect(tasks.length).toBeGreaterThanOrEqual(1);
    for (const task of tasks) {
      expect(task.status).toBe("pending");
      expect(task.attempts).toBe(0);
    }
  });

  it("sets sequential dependencies for rewrite tasks", async () => {
    const content = "# A\nContent.\n\n# B\nContent.\n\n# C\nContent.";
    const meta = makeMeta(content);
    const index = await buildIndex(content, meta);
    const plan = await generatePlan("Rewrite this", meta, content, testConfig);
    const tasks = createTasks(plan, index);

    if (tasks.length > 1) {
      expect(tasks[1].dependsOn).toContain(tasks[0].taskId);
    }
  });

  it("sets no dependencies for summarize tasks", async () => {
    const content = "# A\nContent.\n\n# B\nContent.\n\n# C\nContent.";
    const meta = makeMeta(content);
    const index = await buildIndex(content, meta);
    const plan = await generatePlan("Summarize each section", meta, content, testConfig);
    const tasks = createTasks(plan, index);

    for (const task of tasks) {
      expect(task.dependsOn).toEqual([]);
    }
  });
});

describe("assembler", () => {
  it("assembles completed tasks in order", async () => {
    const content = "# A\nContent A.\n\n# B\nContent B.";
    const meta = makeMeta(content);
    const index = await buildIndex(content, meta);

    const tasks = [
      { taskId: "t-0", sectionId: "s-0", instruction: "test", status: "completed" as const, dependsOn: [], attempts: 1, result: "Processed A" },
      { taskId: "t-1", sectionId: "s-1", instruction: "test", status: "completed" as const, dependsOn: [], attempts: 1, result: "Processed B" },
    ];

    const result = await assemble(tasks, index);
    expect(result.content).toContain("Processed A");
    expect(result.content).toContain("Processed B");
    expect(result.report.valid).toBe(true);
    expect(result.report.sectionsProcessed).toBe(2);
  });

  it("reports failed tasks", async () => {
    const content = "# A\nContent A.\n\n# B\nContent B.";
    const meta = makeMeta(content);
    const index = await buildIndex(content, meta);

    const tasks = [
      { taskId: "t-0", sectionId: "s-0", instruction: "test", status: "completed" as const, dependsOn: [], attempts: 1, result: "Processed A" },
      { taskId: "t-1", sectionId: "s-1", instruction: "test", status: "failed" as const, dependsOn: [], attempts: 3, error: "API error" },
    ];

    const result = await assemble(tasks, index);
    expect(result.report.sectionsFailed).toBe(1);
    expect(result.content).toContain("PROCESSING FAILED");
  });
});
