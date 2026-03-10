import type { InstructionType } from "../types/index.js";

export interface ExecutionPromptParams {
  instruction: string;
  instructionType: InstructionType;
  sectionContent: string;
  overlapBefore: string;
  overlapAfter: string;
  sectionHeading?: string;
  sectionIndex: number;
  totalSections: number;
}

export function buildExecutionPrompt(params: ExecutionPromptParams): {
  system: string;
  user: string;
} {
  return {
    system: `You are a document processing agent. You are working on section ${params.sectionIndex + 1} of ${params.totalSections}.

Your task type is: ${params.instructionType}.

Rules:
- Process ONLY the main section content below.
- The overlap context is provided for continuity -- do NOT include it in your output.
- Maintain consistent style, tone, and formatting with surrounding sections.
- Output ONLY the processed section content, nothing else.
- Do not add preamble, explanations, or meta-commentary.
- Preserve structural markers (headings, lists, code blocks) unless the instruction explicitly asks to remove them.`,

    user: `## Instruction
${params.instruction}

## Context Before (for continuity only, do NOT include in output)
${params.overlapBefore || "(start of document)"}

## Section to Process${params.sectionHeading ? ` -- "${params.sectionHeading}"` : ""}
${params.sectionContent}

## Context After (for continuity only, do NOT include in output)
${params.overlapAfter || "(end of document)"}`,
  };
}

export function buildPlanRefinementPrompt(
  instruction: string,
  documentSample: string,
  estimatedTokens: number,
  format: string,
): { system: string; user: string } {
  return {
    system: `You are a document processing planner. Analyze the instruction and document sample to determine the best processing strategy.

Respond with JSON:
{
  "instructionType": "rewrite|summarize|translate|extract|transform|edit|analyze|convert",
  "chunkingStrategy": "heading|paragraph|page|token",
  "notes": "brief explanation of your choices"
}`,

    user: `Instruction: ${instruction}

Document format: ${format}
Estimated tokens: ${estimatedTokens}

Document sample (first ~2000 chars):
${documentSample.slice(0, 2000)}`,
  };
}
