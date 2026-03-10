import { appendFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { v4 as uuidv4 } from "uuid";
import type { Checkpoint, OperationState } from "../types/index.js";
import { sha256 } from "../utils/hash.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger("checkpoint");

function computeStateHash(state: OperationState): string {
  const key = JSON.stringify({
    phase: state.phase,
    tasks: state.tasks.map((t) => ({ id: t.taskId, status: t.status })),
  });
  return sha256(key);
}

export function createCheckpoint(state: OperationState): Checkpoint {
  const completedCount = state.tasks.filter((t) => t.status === "completed").length;

  return {
    checkpointId: `cp-${uuidv4().slice(0, 8)}`,
    phase: state.phase,
    taskIndex: completedCount,
    timestamp: new Date().toISOString(),
    stateHash: computeStateHash(state),
  };
}

export async function saveCheckpoint(
  state: OperationState,
  stateDir: string,
): Promise<Checkpoint> {
  const checkpoint = createCheckpoint(state);
  state.checkpoints.push(checkpoint);

  const line = `| ${checkpoint.checkpointId} | ${checkpoint.phase} | ${checkpoint.taskIndex} | ${checkpoint.timestamp} | ${checkpoint.stateHash.slice(0, 12)} |\n`;
  const filePath = join(stateDir, state.operationId, "CHECKPOINTS.md");

  try {
    await readFile(filePath, "utf-8");
  } catch {
    const header = [
      "# Checkpoints",
      "",
      "| ID | Phase | Tasks Done | Timestamp | Hash |",
      "|---|---|---|---|---|",
      "",
    ].join("\n");
    const { writeFile: wf } = await import("node:fs/promises");
    await wf(filePath, header, "utf-8");
  }

  await appendFile(filePath, line, "utf-8");
  log.debug("Checkpoint saved", { id: checkpoint.checkpointId, phase: checkpoint.phase });

  return checkpoint;
}

export function validateCheckpoint(state: OperationState, checkpoint: Checkpoint): boolean {
  const currentHash = computeStateHash(state);
  return currentHash === checkpoint.stateHash;
}

export function getLatestCheckpoint(state: OperationState): Checkpoint | undefined {
  return state.checkpoints[state.checkpoints.length - 1];
}
