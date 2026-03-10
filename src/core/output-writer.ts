import type { ExecutionPlan, OperationState } from "../types/index.js";
import { writeDocument } from "../formats/writer.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger("output-writer");

export async function writeOutput(
  content: string,
  plan: ExecutionPlan,
  title?: string,
): Promise<string> {
  await writeDocument(plan.outputPath, content, plan.outputFormat, title);
  log.info("Output written", { path: plan.outputPath, format: plan.outputFormat });
  return plan.outputPath;
}

export function generateChangeSummary(state: OperationState): string {
  const { plan, tasks } = state;
  const report = state.assemblyReport;

  const completed = tasks.filter((t) => t.status === "completed").length;
  const failed = tasks.filter((t) => t.status === "failed").length;
  const total = tasks.length;

  const lines: string[] = [
    `# Document Processing Summary`,
    ``,
    `- **Operation**: ${plan.operationId}`,
    `- **Instruction**: ${plan.instruction}`,
    `- **Type**: ${plan.instructionType}`,
    `- **Input**: ${state.documentPath}`,
    `- **Output**: ${plan.outputPath}`,
    `- **Format**: ${plan.outputFormat}`,
    ``,
    `## Progress`,
    ``,
    `- Sections processed: ${completed}/${total}`,
    failed > 0 ? `- Sections failed: ${failed}` : null,
    `- Chunking strategy: ${plan.chunkingStrategy}`,
    `- Token budget per window: ${plan.tokenBudget}`,
  ].filter(Boolean) as string[];

  if (report) {
    lines.push(
      ``,
      `## Integrity`,
      ``,
      `- Input tokens: ${report.totalInputTokens}`,
      `- Output tokens: ${report.totalOutputTokens}`,
      `- Boundary duplications fixed: ${report.duplicationsDetected}`,
      `- Gaps detected: ${report.gapsDetected}`,
      `- Valid: ${report.valid ? "Yes" : "No"}`,
    );

    if (report.issues.length > 0) {
      lines.push(``, `## Issues`, ``);
      for (const issue of report.issues) {
        lines.push(`- ${issue}`);
      }
    }
  }

  if (state.createdAt && state.completedAt) {
    const durationMs = new Date(state.completedAt).getTime() - new Date(state.createdAt).getTime();
    const durationSec = Math.round(durationMs / 1000);
    lines.push(``, `## Timing`, ``, `- Duration: ${durationSec}s`);
  }

  return lines.join("\n");
}
