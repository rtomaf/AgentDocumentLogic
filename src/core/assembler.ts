import type { AssemblyReport, DocumentIndex, SectionTask } from "../types/index.js";
import { createLogger } from "../utils/logger.js";
import { countTokens } from "../chunking/token-counter.js";

const log = createLogger("assembler");

function detectDuplication(textA: string, textB: string, checkChars = 100): string | null {
  if (textA.length < checkChars || textB.length < checkChars) return null;

  const endA = textA.slice(-checkChars);
  const startB = textB.slice(0, checkChars);

  // Check for overlapping text at boundaries
  for (let len = Math.min(checkChars, 50); len >= 20; len--) {
    const suffix = endA.slice(-len);
    const idx = startB.indexOf(suffix);
    if (idx !== -1) {
      return suffix;
    }
  }

  return null;
}

function deduplicateBoundary(textA: string, textB: string): { cleanA: string; cleanB: string } {
  const duplicate = detectDuplication(textA, textB);
  if (!duplicate) return { cleanA: textA, cleanB: textB };

  log.warn("Duplication detected at boundary, removing", { chars: duplicate.length });
  return {
    cleanA: textA,
    cleanB: textB.slice(textB.indexOf(duplicate) + duplicate.length),
  };
}

export interface AssemblyResult {
  content: string;
  report: AssemblyReport;
}

export async function assemble(
  tasks: SectionTask[],
  index: DocumentIndex,
): Promise<AssemblyResult> {
  const sortedTasks = [...tasks].sort((a, b) => {
    const aIdx = index.sections.findIndex((s) => s.id === a.sectionId.split(",")[0]);
    const bIdx = index.sections.findIndex((s) => s.id === b.sectionId.split(",")[0]);
    return aIdx - bIdx;
  });

  const completedTasks = sortedTasks.filter((t) => t.status === "completed" && t.result);
  const failedTasks = sortedTasks.filter((t) => t.status === "failed");
  const issues: string[] = [];
  let duplicationsDetected = 0;

  // Merge results with boundary deduplication
  const parts: string[] = [];
  for (let i = 0; i < sortedTasks.length; i++) {
    const task = sortedTasks[i];
    if (task.status === "failed" || !task.result) {
      const heading = index.sections.find((s) => s.id === task.sectionId.split(",")[0])?.heading;
      parts.push(`\n\n[PROCESSING FAILED: ${heading ?? task.sectionId}]\n\n`);
      issues.push(`Section ${task.sectionId} failed: ${task.error}`);
      continue;
    }

    if (parts.length > 0) {
      const prev = parts[parts.length - 1];
      const { cleanA, cleanB } = deduplicateBoundary(prev, task.result);
      if (cleanA !== prev) {
        parts[parts.length - 1] = cleanA;
        duplicationsDetected++;
      }
      parts.push(cleanB);
    } else {
      parts.push(task.result);
    }
  }

  // Check for gaps
  const processedSectionIds = new Set(
    sortedTasks.flatMap((t) => t.sectionId.split(",")),
  );
  const allSectionIds = new Set(index.sections.map((s) => s.id));
  const missingSections = [...allSectionIds].filter((id) => !processedSectionIds.has(id));

  if (missingSections.length > 0) {
    issues.push(`Missing sections: ${missingSections.join(", ")}`);
  }

  const content = parts.join("\n\n");
  const totalOutputTokens = await countTokens(content);

  const report: AssemblyReport = {
    totalSections: index.sections.length,
    sectionsProcessed: completedTasks.length,
    sectionsFailed: failedTasks.length,
    totalInputTokens: index.totalTokens,
    totalOutputTokens,
    duplicationsDetected,
    gapsDetected: missingSections.length,
    valid: failedTasks.length === 0 && missingSections.length === 0,
    issues,
  };

  log.info("Assembly complete", {
    sections: report.sectionsProcessed,
    failed: report.sectionsFailed,
    valid: report.valid,
  });

  return { content, report };
}
