import { stat } from "node:fs/promises";
import type { DocumentMeta, OperationResult, OperationState } from "../types/index.js";
import type { PluginConfig } from "../types/config.js";
import { detectFormat } from "../formats/detector.js";
import { readDocument } from "../formats/reader.js";
import { buildIndex } from "./indexer.js";
import { generatePlan } from "./planner.js";
import { createTasks } from "./decomposer.js";
import { executeTasks } from "./executor.js";
import { assemble } from "./assembler.js";
import { writeOutput, generateChangeSummary } from "./output-writer.js";
import { LLMProvider } from "../llm/provider.js";
import { OperationStore } from "../state/operation-store.js";
import { saveCheckpoint } from "../state/checkpoint.js";
import { countTokens } from "../chunking/token-counter.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger("agent-loop");

async function getDocumentMeta(filePath: string): Promise<DocumentMeta> {
  const format = await detectFormat(filePath);
  const fileStats = await stat(filePath);
  const content = await readDocument(filePath, format);
  const estimatedTokens = await countTokens(content);

  return {
    path: filePath,
    format,
    sizeBytes: fileStats.size,
    estimatedTokens,
  };
}

export async function runAgentLoop(
  documentPath: string,
  instruction: string,
  config: PluginConfig,
  resumeFromOp?: string,
): Promise<OperationResult> {
  const startTime = Date.now();
  const store = new OperationStore(config.stateDir);
  const llm = new LLMProvider(config.openaiApiKey, config.reasoningEffort);

  let state: OperationState;

  // ===== PHASE 1: INTAKE =====
  if (resumeFromOp) {
    log.info("Resuming operation", { operationId: resumeFromOp });
    state = await store.loadState(resumeFromOp);

    // Jump to the appropriate phase
    if (state.phase === "completed") {
      return { success: true, operationId: state.operationId, outputPath: state.plan.outputPath };
    }
    if (state.phase === "execute") {
      // Resume execution from where we left off
      log.info("Resuming from execute phase");
    }
  } else {
    log.info("Starting new operation", { documentPath, instruction });
    const meta = await getDocumentMeta(documentPath);
    log.info("Document analyzed", {
      format: meta.format,
      sizeBytes: meta.sizeBytes,
      estimatedTokens: meta.estimatedTokens,
    });

    // ===== PHASE 2: PLAN =====
    const content = await readDocument(documentPath, meta.format);
    const sample = content.slice(0, 7000); // ~2000 tokens
    const plan = await generatePlan(instruction, meta, sample, config, llm);

    log.info("Plan generated", {
      operationId: plan.operationId,
      instructionType: plan.instructionType,
      chunkingStrategy: plan.chunkingStrategy,
      estimatedSteps: plan.estimatedSteps,
    });

    // ===== PHASE 3: INDEX =====
    const index = await buildIndex(content, meta);

    log.info("Index built", {
      sections: index.sections.length,
      totalTokens: index.totalTokens,
      treeDepth: index.treeDepth,
    });

    // ===== PHASE 4: DECOMPOSE =====
    const tasks = createTasks(plan, index);

    log.info("Tasks created", { count: tasks.length });

    // Initialize state
    state = {
      operationId: plan.operationId,
      documentPath,
      phase: "execute",
      plan,
      index,
      tasks,
      checkpoints: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await store.saveState(state);
    await saveCheckpoint(state, config.stateDir);
  }

  // ===== PHASE 5: EXECUTE =====
  state.phase = "execute";

  try {
    await executeTasks(state, llm, config, async (_task) => {
      // Save after each task completion
      await store.saveState(state);
      await saveCheckpoint(state, config.stateDir);
      log.info(`Progress: ${state.tasks.filter((t) => t.status === "completed").length}/${state.tasks.length}`);
    });
  } catch (error) {
    state.phase = "failed";
    state.error = error instanceof Error ? error.message : String(error);
    await store.saveState(state);
    log.error("Execution failed", { error: state.error });

    return {
      success: false,
      operationId: state.operationId,
      error: state.error,
    };
  }

  // Check if any tasks failed
  const failedTasks = state.tasks.filter((t) => t.status === "failed");
  if (failedTasks.length === state.tasks.length) {
    state.phase = "failed";
    state.error = "All tasks failed";
    await store.saveState(state);
    return {
      success: false,
      operationId: state.operationId,
      error: state.error,
    };
  }

  // ===== PHASE 6: ASSEMBLE =====
  state.phase = "assemble";
  log.info("Assembling document");

  const assembled = await assemble(state.tasks, state.index);
  state.assembledContent = assembled.content;
  state.assemblyReport = assembled.report;
  await store.saveState(state);
  await saveCheckpoint(state, config.stateDir);

  log.info("Assembly complete", {
    valid: assembled.report.valid,
    sections: assembled.report.sectionsProcessed,
    issues: assembled.report.issues.length,
  });

  // ===== PHASE 7: OUTPUT =====
  state.phase = "output";
  const outputPath = await writeOutput(assembled.content, state.plan, state.index.meta.title);

  state.phase = "completed";
  state.completedAt = new Date().toISOString();
  await store.saveState(state);

  const changeSummary = generateChangeSummary(state);
  const durationMs = Date.now() - startTime;

  log.info("Operation complete", {
    operationId: state.operationId,
    outputPath,
    durationMs,
  });

  return {
    success: true,
    operationId: state.operationId,
    outputPath,
    changeSummary,
    stats: {
      sectionsProcessed: state.tasks.filter((t) => t.status === "completed").length,
      totalTokensUsed: state.assemblyReport?.totalOutputTokens ?? 0,
      durationMs,
    },
  };
}
