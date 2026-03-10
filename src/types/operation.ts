import type { DocumentFormat, DocumentIndex } from "./document.js";

export type OperationPhase =
  | "intake"
  | "plan"
  | "index"
  | "decompose"
  | "execute"
  | "assemble"
  | "output"
  | "completed"
  | "failed";

export type TaskStatus = "pending" | "in_progress" | "completed" | "failed" | "skipped";

export type InstructionType =
  | "rewrite"
  | "summarize"
  | "translate"
  | "extract"
  | "transform"
  | "edit"
  | "analyze"
  | "convert";

export type ChunkingStrategy = "heading" | "paragraph" | "page" | "token";

export interface SectionTask {
  taskId: string;
  sectionId: string;
  instruction: string;
  status: TaskStatus;
  dependsOn: string[];
  result?: string;
  error?: string;
  attempts: number;
  startedAt?: string;
  completedAt?: string;
}

export interface ExecutionPlan {
  operationId: string;
  instruction: string;
  instructionType: InstructionType;
  chunkingStrategy: ChunkingStrategy;
  tokenBudget: number;
  overlapTokens: number;
  estimatedSteps: number;
  estimatedTotalTokens: number;
  outputFormat: DocumentFormat;
  outputPath: string;
}

export interface Checkpoint {
  checkpointId: string;
  phase: OperationPhase;
  taskIndex: number;
  timestamp: string;
  stateHash: string;
}

export interface OperationState {
  operationId: string;
  documentPath: string;
  phase: OperationPhase;
  plan: ExecutionPlan;
  index: DocumentIndex;
  tasks: SectionTask[];
  checkpoints: Checkpoint[];
  assembledContent?: string;
  assemblyReport?: AssemblyReport;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  error?: string;
}

export interface AssemblyReport {
  totalSections: number;
  sectionsProcessed: number;
  sectionsFailed: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  duplicationsDetected: number;
  gapsDetected: number;
  valid: boolean;
  issues: string[];
}

export interface OperationResult {
  success: boolean;
  operationId: string;
  outputPath?: string;
  changeSummary?: string;
  error?: string;
  stats?: {
    sectionsProcessed: number;
    totalTokensUsed: number;
    durationMs: number;
  };
}
