import type { DocumentIndex, ExecutionPlan, OperationState, SectionTask } from "../types/index.js";
import type { LLMProvider } from "../llm/provider.js";
import type { PluginConfig } from "../types/config.js";
import { buildExecutionPrompt } from "../llm/prompts.js";
import { createLogger } from "../utils/logger.js";
import { isRetryableError } from "../utils/errors.js";

const log = createLogger("executor");

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getSectionContent(index: DocumentIndex, sectionId: string): string {
  // Handle merged sections (comma-separated IDs)
  const ids = sectionId.split(",");
  return ids
    .map((id) => {
      const section = index.sections.find((s) => s.id === id);
      return section?.content ?? "";
    })
    .join("\n\n");
}

function getOverlapContext(
  index: DocumentIndex,
  sectionId: string,
  overlapTokens: number,
  direction: "before" | "after",
): string {
  const ids = sectionId.split(",");
  const targetId = direction === "before" ? ids[0] : ids[ids.length - 1];
  const section = index.sections.find((s) => s.id === targetId);
  if (!section) return "";

  const adjacentIndex = direction === "before" ? section.index - 1 : section.index + 1;
  const adjacent = index.sections.find((s) => s.index === adjacentIndex);
  if (!adjacent) return "";

  const overlapChars = Math.floor(overlapTokens * 3.5);
  if (direction === "before") {
    return adjacent.content.slice(-overlapChars);
  } else {
    return adjacent.content.slice(0, overlapChars);
  }
}

export async function executeTask(
  task: SectionTask,
  plan: ExecutionPlan,
  index: DocumentIndex,
  llm: LLMProvider,
  _config: PluginConfig,
): Promise<string> {
  const sectionContent = getSectionContent(index, task.sectionId);
  const overlapBefore = getOverlapContext(index, task.sectionId, plan.overlapTokens, "before");
  const overlapAfter = getOverlapContext(index, task.sectionId, plan.overlapTokens, "after");

  const sectionIds = task.sectionId.split(",");
  const firstSection = index.sections.find((s) => s.id === sectionIds[0]);
  const sectionIndex = firstSection?.index ?? 0;
  const totalSections = index.sections.length;

  const prompts = buildExecutionPrompt({
    instruction: plan.instruction,
    instructionType: plan.instructionType,
    sectionContent,
    overlapBefore,
    overlapAfter,
    sectionHeading: firstSection?.heading,
    sectionIndex,
    totalSections,
  });

  const result = await llm.complete(prompts.system, prompts.user);

  if (!result || result.trim().length === 0) {
    throw new Error(`Empty result for task ${task.taskId}`);
  }

  return result;
}

export async function executeTasks(
  state: OperationState,
  llm: LLMProvider,
  config: PluginConfig,
  onTaskComplete?: (task: SectionTask) => Promise<void>,
): Promise<void> {
  const { tasks, plan, index } = state;

  for (const task of tasks) {
    if (task.status === "completed" || task.status === "skipped") continue;

    // Check dependencies
    const depsComplete = task.dependsOn.every((depId) => {
      const dep = tasks.find((t) => t.taskId === depId);
      return dep && (dep.status === "completed" || dep.status === "skipped");
    });

    if (!depsComplete) {
      log.warn(`Skipping task ${task.taskId}: dependencies not met`);
      continue;
    }

    task.status = "in_progress";
    task.startedAt = new Date().toISOString();
    task.attempts++;

    log.info(`Executing task ${task.taskId}`, {
      sectionId: task.sectionId,
      attempt: task.attempts,
    });

    try {
      const result = await executeTask(task, plan, index, llm, config);
      task.result = result;
      task.status = "completed";
      task.completedAt = new Date().toISOString();

      log.info(`Task ${task.taskId} completed`);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));

      if (isRetryableError(error) && task.attempts < config.maxRetries) {
        task.status = "pending";
        task.error = err.message;
        log.warn(`Task ${task.taskId} failed (retryable), will retry`, { error: err.message });

        // Exponential backoff
        const delay = 1000 * Math.pow(4, task.attempts - 1);
        await sleep(delay);
      } else {
        task.status = "failed";
        task.error = err.message;
        log.error(`Task ${task.taskId} failed permanently`, { error: err.message });
      }
    }

    if (onTaskComplete) {
      await onTaskComplete(task);
    }
  }
}
