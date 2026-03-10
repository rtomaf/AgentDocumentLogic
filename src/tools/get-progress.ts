import type { PluginConfig } from "../types/config.js";
import { OperationStore } from "../state/operation-store.js";
import { getProgress } from "../state/progress-tracker.js";

export interface GetProgressParams {
  operationId: string;
}

export async function handleGetProgress(params: GetProgressParams, config: PluginConfig) {
  const store = new OperationStore(config.stateDir);

  try {
    const state = await store.loadState(params.operationId);
    return getProgress(state);
  } catch (error) {
    // Try listing available operations
    const operations = await store.listOperations();
    return {
      error: `Operation ${params.operationId} not found`,
      availableOperations: operations,
    };
  }
}
