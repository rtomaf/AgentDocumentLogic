import type {
  ChunkingStrategy,
  DocumentFormat,
  DocumentMeta,
  ExecutionPlan,
  InstructionType,
} from "../types/index.js";
import type { LLMProvider } from "../llm/provider.js";
import type { PluginConfig } from "../types/config.js";
import { v4 as uuidv4 } from "uuid";
import { createLogger } from "../utils/logger.js";

const log = createLogger("planner");

const INSTRUCTION_KEYWORDS: Record<InstructionType, string[]> = {
  rewrite: ["rewrite", "restyle", "rephrase", "reword", "revise", "improve writing", "make it"],
  summarize: ["summarize", "summary", "condense", "shorten", "brief", "tldr", "key points"],
  translate: ["translate", "translation", "convert to", "in spanish", "in french", "in german", "localize"],
  extract: ["extract", "pull out", "find all", "list all", "get the", "identify"],
  transform: ["transform", "restructure", "reorganize", "format as", "convert structure"],
  edit: ["edit", "fix", "correct", "update", "change", "modify", "replace", "add", "remove", "delete"],
  analyze: ["analyze", "analysis", "review", "evaluate", "assess", "critique", "annotate"],
  convert: ["convert", "export as", "save as", "change format"],
};

function classifyInstruction(instruction: string): InstructionType {
  const lower = instruction.toLowerCase();
  let bestMatch: InstructionType = "edit";
  let bestScore = 0;

  for (const [type, keywords] of Object.entries(INSTRUCTION_KEYWORDS)) {
    let score = 0;
    for (const keyword of keywords) {
      if (lower.includes(keyword)) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      bestMatch = type as InstructionType;
    }
  }

  return bestMatch;
}

function selectChunkingStrategy(format: DocumentFormat, instructionType: InstructionType): ChunkingStrategy {
  if (format === "pdf") return "page";

  if (["markdown", "html", "docx"].includes(format)) {
    return "heading";
  }

  if (["summarize", "extract", "analyze"].includes(instructionType)) {
    return "paragraph";
  }

  return "paragraph";
}

function inferOutputFormat(instruction: string, inputFormat: DocumentFormat): DocumentFormat {
  const lower = instruction.toLowerCase();
  if (lower.includes("to markdown") || lower.includes("as markdown") || lower.includes("to md")) return "markdown";
  if (lower.includes("to html") || lower.includes("as html")) return "html";
  if (lower.includes("to pdf") || lower.includes("as pdf")) return "pdf";
  if (lower.includes("to docx") || lower.includes("as docx") || lower.includes("to word")) return "docx";
  if (lower.includes("to text") || lower.includes("to plaintext") || lower.includes("to txt")) return "plaintext";
  return inputFormat;
}

function inferOutputPath(inputPath: string, outputFormat: DocumentFormat): string {
  const extMap: Record<DocumentFormat, string> = {
    plaintext: ".txt",
    markdown: ".md",
    html: ".html",
    docx: ".docx",
    pdf: ".pdf",
  };
  const base = inputPath.replace(/\.[^.]+$/, "");
  return `${base}_processed${extMap[outputFormat]}`;
}

export async function generatePlan(
  instruction: string,
  meta: DocumentMeta,
  _documentSample: string,
  config: PluginConfig,
  llm?: LLMProvider,
): Promise<ExecutionPlan> {
  const operationId = `op-${uuidv4().slice(0, 8)}`;
  const instructionType = classifyInstruction(instruction);
  const chunkingStrategy = selectChunkingStrategy(meta.format, instructionType);
  const outputFormat = inferOutputFormat(instruction, meta.format);
  const outputPath = inferOutputPath(meta.path, outputFormat);

  const estimatedSteps = Math.max(1, Math.ceil(meta.estimatedTokens / config.defaultTokenBudget));

  log.info("Plan generated", {
    operationId,
    instructionType,
    chunkingStrategy,
    estimatedSteps,
    outputFormat,
  });

  // For complex instructions, optionally use LLM to refine the plan
  if (llm && meta.estimatedTokens > 100000) {
    log.info("Using LLM to refine plan for large document");
    // The LLM refinement would validate the automatic classification
    // and potentially override chunkingStrategy or instructionType.
    // For now, we trust the heuristic classification.
  }

  return {
    operationId,
    instruction,
    instructionType,
    chunkingStrategy,
    tokenBudget: config.defaultTokenBudget,
    overlapTokens: config.defaultOverlapTokens,
    estimatedSteps,
    estimatedTotalTokens: meta.estimatedTokens * 2, // input + output estimate
    outputFormat,
    outputPath,
  };
}
