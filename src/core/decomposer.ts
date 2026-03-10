import type { DocumentIndex, ExecutionPlan, InstructionType, SectionTask } from "../types/index.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger("decomposer");

const PARALLEL_INSTRUCTION_TYPES: InstructionType[] = ["summarize", "extract", "analyze", "convert"];

function shouldRunParallel(instructionType: InstructionType): boolean {
  return PARALLEL_INSTRUCTION_TYPES.includes(instructionType);
}

export function createTasks(plan: ExecutionPlan, index: DocumentIndex): SectionTask[] {
  const tasks: SectionTask[] = [];
  const sections = index.sections;
  const isParallel = shouldRunParallel(plan.instructionType);
  const minMergeTokens = 200;

  let i = 0;
  while (i < sections.length) {
    const section = sections[i];

    // Merge tiny adjacent sections into a single task
    if (section.tokenCount < minMergeTokens && i < sections.length - 1) {
      let mergedTokens = section.tokenCount;
      const mergedSectionIds: string[] = [section.id];
      let j = i + 1;

      while (j < sections.length && mergedTokens + sections[j].tokenCount < plan.tokenBudget && sections[j].tokenCount < minMergeTokens) {
        mergedTokens += sections[j].tokenCount;
        mergedSectionIds.push(sections[j].id);
        j++;
      }

      const firstSection = sections[i];
      const heading = firstSection.heading
        ? mergedSectionIds.length > 1
          ? `${firstSection.heading} (+${mergedSectionIds.length - 1} more)`
          : firstSection.heading
        : undefined;

      const taskId = `t-${tasks.length}`;
      const previousTaskId = tasks.length > 0 ? tasks[tasks.length - 1].taskId : undefined;

      tasks.push({
        taskId,
        sectionId: mergedSectionIds.join(","),
        instruction: heading
          ? `${plan.instruction} [Section: ${heading}]`
          : plan.instruction,
        status: "pending",
        dependsOn: isParallel || !previousTaskId ? [] : [previousTaskId],
        attempts: 0,
      });

      i = j;
      continue;
    }

    // Large section that exceeds budget: it will be handled by the chunker during execution
    const taskId = `t-${tasks.length}`;
    const previousTaskId = tasks.length > 0 ? tasks[tasks.length - 1].taskId : undefined;

    tasks.push({
      taskId,
      sectionId: section.id,
      instruction: section.heading
        ? `${plan.instruction} [Section: ${section.heading}]`
        : plan.instruction,
      status: "pending",
      dependsOn: isParallel || !previousTaskId ? [] : [previousTaskId],
      attempts: 0,
    });

    i++;
  }

  log.info("Tasks created", {
    total: tasks.length,
    parallel: isParallel,
    sections: sections.length,
  });

  return tasks;
}
