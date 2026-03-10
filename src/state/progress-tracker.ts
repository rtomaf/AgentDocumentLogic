import type { OperationState } from "../types/index.js";

export interface ProgressInfo {
  operationId: string;
  phase: string;
  tasksTotal: number;
  tasksCompleted: number;
  tasksFailed: number;
  tasksInProgress: number;
  tasksPending: number;
  percentComplete: number;
  currentTask?: {
    taskId: string;
    sectionId: string;
    attempt: number;
  };
  estimatedRemaining?: string;
}

export function getProgress(state: OperationState): ProgressInfo {
  const { tasks } = state;
  const total = tasks.length;
  const completed = tasks.filter((t) => t.status === "completed").length;
  const failed = tasks.filter((t) => t.status === "failed").length;
  const inProgress = tasks.filter((t) => t.status === "in_progress").length;
  const pending = tasks.filter((t) => t.status === "pending").length;
  const percentComplete = total > 0 ? Math.round((completed / total) * 100) : 0;

  const currentTask = tasks.find((t) => t.status === "in_progress");
  let estimatedRemaining: string | undefined;

  if (completed > 0 && state.createdAt) {
    const elapsedMs = Date.now() - new Date(state.createdAt).getTime();
    const msPerTask = elapsedMs / completed;
    const remainingTasks = total - completed - failed;
    const remainingMs = msPerTask * remainingTasks;
    const remainingSec = Math.round(remainingMs / 1000);

    if (remainingSec < 60) {
      estimatedRemaining = `${remainingSec}s`;
    } else if (remainingSec < 3600) {
      estimatedRemaining = `${Math.round(remainingSec / 60)}m`;
    } else {
      estimatedRemaining = `${Math.round(remainingSec / 3600)}h`;
    }
  }

  return {
    operationId: state.operationId,
    phase: state.phase,
    tasksTotal: total,
    tasksCompleted: completed,
    tasksFailed: failed,
    tasksInProgress: inProgress,
    tasksPending: pending,
    percentComplete,
    currentTask: currentTask
      ? { taskId: currentTask.taskId, sectionId: currentTask.sectionId, attempt: currentTask.attempts }
      : undefined,
    estimatedRemaining,
  };
}
