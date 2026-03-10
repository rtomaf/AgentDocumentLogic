import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { OperationStore } from "../src/state/operation-store.js";
import type { OperationState } from "../src/types/index.js";

function makeState(operationId: string): OperationState {
  return {
    operationId,
    documentPath: "/test/document.md",
    phase: "execute",
    plan: {
      operationId,
      instruction: "Rewrite in formal tone",
      instructionType: "rewrite",
      chunkingStrategy: "heading",
      tokenBudget: 50000,
      overlapTokens: 500,
      estimatedSteps: 5,
      estimatedTotalTokens: 100000,
      outputFormat: "markdown",
      outputPath: "/test/document_processed.md",
    },
    index: {
      documentId: "abc123",
      meta: { path: "/test/document.md", format: "markdown", sizeBytes: 1000, estimatedTokens: 300 },
      sections: [
        { id: "s-0", index: 0, heading: "Intro", level: 1, startOffset: 0, endOffset: 100, tokenCount: 30, content: "Intro content", children: [], parentId: undefined },
        { id: "s-1", index: 1, heading: "Body", level: 1, startOffset: 100, endOffset: 500, tokenCount: 120, content: "Body content", children: [], parentId: undefined },
      ],
      totalTokens: 150,
      treeDepth: 1,
      generatedAt: new Date().toISOString(),
    },
    tasks: [
      { taskId: "t-0", sectionId: "s-0", instruction: "Rewrite", status: "completed", dependsOn: [], attempts: 1, result: "Rewritten intro", completedAt: new Date().toISOString() },
      { taskId: "t-1", sectionId: "s-1", instruction: "Rewrite", status: "pending", dependsOn: ["t-0"], attempts: 0 },
    ],
    checkpoints: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

describe("OperationStore", () => {
  let tempDir: string;
  let store: OperationStore;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "adl-test-"));
    store = new OperationStore(tempDir);
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("saves and loads operation state", async () => {
    const state = makeState("op-test123");
    await store.saveState(state);

    const loaded = await store.loadState("op-test123");
    expect(loaded.operationId).toBe("op-test123");
    expect(loaded.phase).toBe("execute");
    expect(loaded.documentPath).toBe("/test/document.md");
  });

  it("persists completed task results as section files", async () => {
    const state = makeState("op-sections");
    await store.saveState(state);

    const loaded = await store.loadState("op-sections");
    const completedTask = loaded.tasks.find((t) => t.taskId === "t-0");
    expect(completedTask?.result).toBe("Rewritten intro");
  });

  it("lists operations", async () => {
    await store.saveState(makeState("op-first"));
    await store.saveState(makeState("op-second"));

    const ops = await store.listOperations();
    expect(ops.length).toBe(2);
    expect(ops.map((o) => o.operationId)).toContain("op-first");
    expect(ops.map((o) => o.operationId)).toContain("op-second");
  });

  it("deletes operations", async () => {
    await store.saveState(makeState("op-delete"));
    let ops = await store.listOperations();
    expect(ops.length).toBe(1);

    await store.deleteOperation("op-delete");
    ops = await store.listOperations();
    expect(ops.length).toBe(0);
  });

  it("returns empty list for nonexistent state dir", async () => {
    const emptyStore = new OperationStore("/nonexistent/path");
    const ops = await emptyStore.listOperations();
    expect(ops).toEqual([]);
  });
});
