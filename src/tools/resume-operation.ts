import type { PluginConfig } from "../types/config.js";
import { runAgentLoop } from "../core/agent-loop.js";
import { OperationStore } from "../state/operation-store.js";

export interface ResumeOperationParams {
  operationId: string;
  skipFailed?: boolean;
}

export async function handleResumeOperation(params: ResumeOperationParams, config: PluginConfig) {
  const store = new OperationStore(config.stateDir);

  try {
    const state = await store.loadState(params.operationId);

    if (state.phase === "completed") {
      return {
        message: "Operation already completed",
        operationId: state.operationId,
        outputPath: state.plan.outputPath,
      };
    }

    // Reset failed tasks if requested
    if (params.skipFailed) {
      for (const task of state.tasks) {
        if (task.status === "failed") {
          task.status = "skipped";
        }
      }
      await store.saveState(state);
    } else {
      // Reset failed tasks to pending for retry
      for (const task of state.tasks) {
        if (task.status === "failed") {
          task.status = "pending";
          task.attempts = 0;
          task.error = undefined;
        }
        if (task.status === "in_progress") {
          task.status = "pending"; // Interrupted tasks restart
        }
      }
      await store.saveState(state);
    }

    // Resume the agent loop
    const result = await runAgentLoop(
      state.documentPath,
      state.plan.instruction,
      config,
      params.operationId,
    );

    return result;
  } catch (error) {
    const operations = await store.listOperations();
    return {
      error: `Failed to resume: ${error instanceof Error ? error.message : String(error)}`,
      availableOperations: operations,
    };
  }
}
