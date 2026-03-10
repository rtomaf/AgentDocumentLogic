import { resolveConfig } from "./types/config.js";
import { handleReadDocument } from "./tools/read-document.js";
import { handleWriteDocument } from "./tools/write-document.js";
import { handleEditSection } from "./tools/edit-section.js";
import { handleCreateIndex } from "./tools/create-index.js";
import { handleGetSection } from "./tools/get-section.js";
import { handleValidateDocument } from "./tools/validate-document.js";
import { handleGetProgress } from "./tools/get-progress.js";
import { handleResumeOperation } from "./tools/resume-operation.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

interface PluginApi {
  pluginConfig?: Record<string, unknown>;
  logger: { info: (...args: Any[]) => void; error: (...args: Any[]) => void; warn?: (...args: Any[]) => void };
  registerTool: (tool: Any) => void;
}

function wrapExecute(handler: (params: Any, config: Any) => Promise<Any>, config: Any) {
  return async (_toolCallId: string, params: Any, _signal?: AbortSignal) => {
    try {
      const result = await handler(params, config);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        details: result,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: "text" as const, text: `Error: ${message}` }],
        details: { error: message },
      };
    }
  };
}

export default function register(api: PluginApi) {
  const pluginCfg = (api.pluginConfig ?? {}) as Record<string, unknown>;
  const openaiApiKey = (pluginCfg.openaiApiKey as string)
    || process.env.OPENAI_API_KEY
    || "";

  if (!openaiApiKey) {
    api.logger.warn?.("[agent-document-logic] No OpenAI API key found. Set OPENAI_API_KEY or provide openaiApiKey in plugin config.");
  }

  const config = resolveConfig({
    openaiApiKey,
    stateDir: (pluginCfg.stateDir as string) || undefined,
    defaultTokenBudget: (pluginCfg.defaultTokenBudget as number) || undefined,
    defaultOverlapTokens: (pluginCfg.defaultOverlapTokens as number) || undefined,
    maxRetries: (pluginCfg.maxRetries as number) || undefined,
    reasoningEffort: (pluginCfg.reasoningEffort as "low" | "medium" | "high") || undefined,
  });

  const tools = [
    {
      name: "adl_read",
      label: "ADL Read Document",
      description:
        "Read a document file from disk with automatic format detection (txt, md, docx, pdf, html), structural parsing into sections, and token counting. Returns metadata and section index.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Absolute path to the document file" },
          sectionId: { type: "string", description: "Specific section ID to read (from index)" },
          chunkIndex: { type: "number", description: "Specific chunk index for paginated reading" },
          includeContent: { type: "boolean", description: "Force include raw content (default: auto based on size)" },
        },
        required: ["path"],
      },
      execute: wrapExecute(handleReadDocument, config),
    },
    {
      name: "adl_write",
      label: "ADL Write Document",
      description: "Write or create a document file on disk in the specified format. Supports plaintext, markdown, HTML, DOCX, and PDF output.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Output file path" },
          content: { type: "string", description: "Document content to write" },
          format: { type: "string", description: "Target format: plaintext|markdown|docx|pdf|html (auto-detected from extension)" },
          title: { type: "string", description: "Document title (used in HTML/PDF headers)" },
        },
        required: ["path", "content"],
      },
      execute: wrapExecute(handleWriteDocument, config),
    },
    {
      name: "adl_edit_section",
      label: "ADL Edit Section",
      description:
        "Replace the content of a specific section in a document file on disk, identified by section ID from adl_index. Preserves heading and surrounding content.",
      parameters: {
        type: "object",
        properties: {
          documentPath: { type: "string", description: "Path to the document" },
          sectionId: { type: "string", description: "Section ID from the document index" },
          newContent: { type: "string", description: "Replacement content for the section" },
          preserveHeading: { type: "boolean", description: "Keep original heading (default: true)" },
        },
        required: ["documentPath", "sectionId", "newContent"],
      },
      execute: wrapExecute(handleEditSection, config),
    },
    {
      name: "adl_index",
      label: "ADL Create Index",
      description:
        "Parse a document file on disk and generate a structural index showing all sections, headings, hierarchy levels, and token counts per section.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Path to the document" },
        },
        required: ["path"],
      },
      execute: wrapExecute(handleCreateIndex, config),
    },
    {
      name: "adl_get_section",
      label: "ADL Get Section",
      description: "Retrieve a specific section's full content from a document file on disk, by section ID or index. Optionally includes overlap context from adjacent sections.",
      parameters: {
        type: "object",
        properties: {
          documentPath: { type: "string", description: "Path to the document" },
          sectionId: { type: "string", description: "Section ID (e.g., 's-3')" },
          sectionIndex: { type: "number", description: "Section ordinal index (0-based)" },
          includeOverlap: { type: "boolean", description: "Include overlap context from adjacent sections" },
          overlapTokens: { type: "number", description: "Number of overlap tokens (default: 500)" },
        },
        required: ["documentPath"],
      },
      execute: wrapExecute(handleGetSection, config),
    },
    {
      name: "adl_validate",
      label: "ADL Validate",
      description:
        "Validate a document file's structural integrity on disk: check for section gaps, broken references, encoding issues, and format compliance.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Path to the document" },
          checks: {
            type: "array",
            items: { type: "string" },
            description: "Specific checks: structure|encoding|references|format (default: all)",
          },
        },
        required: ["path"],
      },
      execute: wrapExecute(handleValidateDocument, config),
    },
    {
      name: "adl_progress",
      label: "ADL Progress",
      description: "Check the current progress of an ongoing ADL document processing operation by operation ID.",
      parameters: {
        type: "object",
        properties: {
          operationId: { type: "string", description: "Operation ID to check" },
        },
        required: ["operationId"],
      },
      execute: wrapExecute(handleGetProgress, config),
    },
    {
      name: "adl_resume",
      label: "ADL Resume",
      description: "Resume an interrupted ADL document processing operation from its last checkpoint.",
      parameters: {
        type: "object",
        properties: {
          operationId: { type: "string", description: "Operation ID to resume" },
          skipFailed: { type: "boolean", description: "Skip previously failed tasks instead of retrying (default: false)" },
        },
        required: ["operationId"],
      },
      execute: wrapExecute(handleResumeOperation, config),
    },
  ];

  for (const tool of tools) {
    api.registerTool(tool);
  }

  api.logger.info(`[agent-document-logic] Plugin loaded with ${tools.length} tools`);
}
