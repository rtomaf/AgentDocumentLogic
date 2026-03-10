import { mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import matter from "gray-matter";
import type { OperationState, SectionTask } from "../types/index.js";
import { StateError } from "../utils/errors.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger("operation-store");

function taskToChecklistLine(task: SectionTask): string {
  const check = task.status === "completed" ? "x" : " ";
  const time = task.completedAt ?? (task.startedAt ? `attempts: ${task.attempts}` : "");
  return `- [${check}] \`${task.taskId}\` | Section ${task.sectionId} | ${task.status} | ${time}`;
}

function parseChecklistLine(line: string): Partial<SectionTask> | null {
  const match = line.match(/^- \[([ x])\] `(t-\d+)` \| Section ([^\|]+) \| (\w+)/);
  if (!match) return null;
  return {
    taskId: match[2],
    sectionId: match[3].trim(),
    status: match[4] as SectionTask["status"],
  };
}

export class OperationStore {
  constructor(private stateDir: string) {}

  private opDir(operationId: string): string {
    return join(this.stateDir, operationId);
  }

  async saveState(state: OperationState): Promise<void> {
    const dir = this.opDir(state.operationId);
    await mkdir(dir, { recursive: true });
    await mkdir(join(dir, "sections"), { recursive: true });

    state.updatedAt = new Date().toISOString();

    // Write OPERATION.md
    const operationContent = matter.stringify(
      [
        `# Execution Plan`,
        ``,
        `- **Instruction**: ${state.plan.instruction}`,
        `- **Instruction Type**: ${state.plan.instructionType}`,
        `- **Chunking Strategy**: ${state.plan.chunkingStrategy}`,
        `- **Token Budget**: ${state.plan.tokenBudget}`,
        `- **Overlap Tokens**: ${state.plan.overlapTokens}`,
        `- **Output Format**: ${state.plan.outputFormat}`,
        `- **Output Path**: ${state.plan.outputPath}`,
        `- **Estimated Steps**: ${state.plan.estimatedSteps}`,
      ].join("\n"),
      {
        operationId: state.operationId,
        documentPath: state.documentPath,
        phase: state.phase,
        createdAt: state.createdAt,
        updatedAt: state.updatedAt,
        completedAt: state.completedAt ?? null,
        error: state.error ?? null,
      },
    );
    await this.atomicWrite(join(dir, "OPERATION.md"), operationContent);

    // Write TASKS.md
    const completed = state.tasks.filter((t) => t.status === "completed").length;
    const failed = state.tasks.filter((t) => t.status === "failed").length;
    const tasksContent = matter.stringify(
      [
        `# Task List`,
        ``,
        ...state.tasks.map(taskToChecklistLine),
      ].join("\n"),
      {
        totalTasks: state.tasks.length,
        completed,
        failed,
      },
    );
    await this.atomicWrite(join(dir, "TASKS.md"), tasksContent);

    // Write completed section results
    for (const task of state.tasks) {
      if (task.status === "completed" && task.result) {
        const sectionFile = join(dir, "sections", `${task.sectionId.replace(/,/g, "_")}.md`);
        await this.atomicWrite(sectionFile, task.result);
      }
    }

    log.debug("State saved", { operationId: state.operationId, phase: state.phase });
  }

  async loadState(operationId: string): Promise<OperationState> {
    const dir = this.opDir(operationId);

    try {
      const operationRaw = await readFile(join(dir, "OPERATION.md"), "utf-8");
      const operationParsed = matter(operationRaw);
      const frontmatter = operationParsed.data as Record<string, unknown>;

      const tasksRaw = await readFile(join(dir, "TASKS.md"), "utf-8");
      const tasksParsed = matter(tasksRaw);
      const taskLines = tasksParsed.content.split("\n").filter((l) => l.startsWith("- ["));
      const tasks: SectionTask[] = taskLines
        .map(parseChecklistLine)
        .filter(Boolean)
        .map((partial) => ({
          taskId: partial!.taskId!,
          sectionId: partial!.sectionId!,
          instruction: "",
          status: partial!.status!,
          dependsOn: [],
          attempts: 0,
        }));

      // Load section results
      try {
        const sectionFiles = await readdir(join(dir, "sections"));
        for (const file of sectionFiles) {
          if (!file.endsWith(".md")) continue;
          const sectionId = file.replace(".md", "").replace(/_/g, ",");
          const content = await readFile(join(dir, "sections", file), "utf-8");
          const task = tasks.find((t) => t.sectionId === sectionId);
          if (task) {
            task.result = content;
            if (task.status !== "completed") task.status = "completed";
          }
        }
      } catch {
        // No sections directory yet
      }

      return {
        operationId,
        documentPath: frontmatter.documentPath as string,
        phase: frontmatter.phase as OperationState["phase"],
        plan: {
          operationId,
          instruction: "",
          instructionType: "edit",
          chunkingStrategy: "heading",
          tokenBudget: 50000,
          overlapTokens: 500,
          estimatedSteps: tasks.length,
          estimatedTotalTokens: 0,
          outputFormat: "markdown",
          outputPath: "",
        },
        index: { documentId: "", meta: { path: "", format: "plaintext", sizeBytes: 0, estimatedTokens: 0 }, sections: [], totalTokens: 0, treeDepth: 0, generatedAt: "" },
        tasks,
        checkpoints: [],
        createdAt: frontmatter.createdAt as string,
        updatedAt: frontmatter.updatedAt as string,
        completedAt: frontmatter.completedAt as string | undefined,
        error: frontmatter.error as string | undefined,
      };
    } catch (error) {
      throw new StateError(`Failed to load operation ${operationId}: ${error}`, operationId);
    }
  }

  async listOperations(): Promise<{ operationId: string; phase: string; updatedAt: string }[]> {
    try {
      const entries = await readdir(this.stateDir, { withFileTypes: true });
      const ops: { operationId: string; phase: string; updatedAt: string }[] = [];

      for (const entry of entries) {
        if (!entry.isDirectory() || !entry.name.startsWith("op-")) continue;
        try {
          const raw = await readFile(join(this.stateDir, entry.name, "OPERATION.md"), "utf-8");
          const parsed = matter(raw);
          ops.push({
            operationId: entry.name,
            phase: parsed.data.phase as string,
            updatedAt: parsed.data.updatedAt as string,
          });
        } catch {
          // Skip corrupted operations
        }
      }

      return ops.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    } catch {
      return [];
    }
  }

  async deleteOperation(operationId: string): Promise<void> {
    await rm(this.opDir(operationId), { recursive: true, force: true });
    log.info("Operation deleted", { operationId });
  }

  private async atomicWrite(filePath: string, content: string): Promise<void> {
    const tmpPath = `${filePath}.tmp`;
    await writeFile(tmpPath, content, "utf-8");
    await rename(tmpPath, filePath);
  }
}
