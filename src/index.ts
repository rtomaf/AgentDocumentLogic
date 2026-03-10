import type { PluginConfig } from "./types/config.js";
import { resolveConfig } from "./types/config.js";
import { handleReadDocument } from "./tools/read-document.js";
import { handleWriteDocument } from "./tools/write-document.js";
import { handleEditSection } from "./tools/edit-section.js";
import { handleCreateIndex } from "./tools/create-index.js";
import { handleGetSection } from "./tools/get-section.js";
import { handleValidateDocument } from "./tools/validate-document.js";
import { handleGetProgress } from "./tools/get-progress.js";
import { handleResumeOperation } from "./tools/resume-operation.js";
import { runAgentLoop } from "./core/agent-loop.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyParams = any;

interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute: (params: AnyParams, config: PluginConfig) => Promise<unknown>;
}

function defineTools(config: PluginConfig): ToolDefinition[] {
  return [
    {
      name: "read_document",
      description:
        "Read a large document with automatic format detection, structural parsing, and chunked access. Returns document metadata, section index, and optionally content.",
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
      execute: (params: AnyParams) => handleReadDocument(params, config),
    },
    {
      name: "write_document",
      description: "Write or create a document in the specified format. Supports plaintext, markdown, HTML, DOCX, and PDF.",
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
      execute: (params: AnyParams) => handleWriteDocument(params, config),
    },
    {
      name: "edit_section",
      description:
        "Edit a specific section of a document by its section ID from the structural index. Preserves surrounding content.",
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
      execute: (params: AnyParams) => handleEditSection(params, config),
    },
    {
      name: "create_index",
      description:
        "Generate a structural index of a document showing all sections, headings, hierarchy, and token counts.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Path to the document" },
        },
        required: ["path"],
      },
      execute: (params: AnyParams) => handleCreateIndex(params, config),
    },
    {
      name: "get_section",
      description: "Retrieve a specific section's content by ID or index from a document, with optional overlap context.",
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
      execute: (params: AnyParams) => handleGetSection(params, config),
    },
    {
      name: "validate_document",
      description:
        "Validate a document's structural integrity: check for gaps, broken references, encoding issues, and format compliance.",
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
      execute: (params: AnyParams) => handleValidateDocument(params, config),
    },
    {
      name: "get_progress",
      description: "Check the current progress of an ongoing document processing operation.",
      parameters: {
        type: "object",
        properties: {
          operationId: { type: "string", description: "Operation ID to check" },
        },
        required: ["operationId"],
      },
      execute: (params: AnyParams) => handleGetProgress(params, config),
    },
    {
      name: "resume_operation",
      description: "Resume an interrupted document processing operation from its last checkpoint.",
      parameters: {
        type: "object",
        properties: {
          operationId: { type: "string", description: "Operation ID to resume" },
          skipFailed: { type: "boolean", description: "Skip previously failed tasks instead of retrying (default: false)" },
        },
        required: ["operationId"],
      },
      execute: (params: AnyParams) => handleResumeOperation(params, config),
    },
  ];
}

// OpenClaw Plugin Definition
export default {
  id: "agent-document-logic",
  name: "Agent Document Logic",
  description:
    "Large document processing agent with structured planning and section-by-section execution",

  register(api: {
    registerTool: (tool: ToolDefinition) => void;
    getConfig: () => Partial<PluginConfig> & { openaiApiKey: string };
    logger: { info: (msg: string) => void };
  }) {
    const rawConfig = api.getConfig();
    const config = resolveConfig(rawConfig);
    const tools = defineTools(config);

    for (const tool of tools) {
      api.registerTool(tool);
    }

    api.logger.info(`Agent Document Logic plugin loaded with ${tools.length} tools`);
  },

  // Expose the agent loop for direct invocation
  runAgentLoop,
};
