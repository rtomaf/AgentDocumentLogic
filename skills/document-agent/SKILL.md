---
name: document-agent
description: >
  Process, transform, and edit large document FILES on disk autonomously using
  adl_* tools. Reads/writes files directly. Handles indexing, section-by-section
  editing, format conversion, and validation. Supports txt, md, docx, pdf, html.
user-invocable: true
disable-model-invocation: false
metadata:
  openclaw:
    always: true
---

# Document File Processing Agent (ADL)

When the user asks you to read, write, edit, transform, summarize, translate, or
analyze a **document file on disk** (by file path), use the `adl_*` tools below.

**Important**: These `adl_*` tools work directly with **files on disk** (by absolute
path). They are different from `doc_*` tools which work with in-memory documents.
Use `adl_*` when the user provides a file path or asks you to process a file.

## Workflow

1. **Index the file**: Use `adl_index` with the file path to see all sections,
   headings, and token counts.

2. **Read sections**: Use `adl_get_section` to read specific sections by ID
   (e.g. `s-3`), with `includeOverlap: true` for context.

3. **Edit sections**: Use `adl_edit_section` to replace a section's content by
   its ID. The heading is preserved automatically.

4. **Write output**: Use `adl_write` to create a new file in any format.

5. **Validate**: Use `adl_validate` to check the file's structural integrity.

## Available tools

| Tool | Purpose |
|------|---------|
| `adl_read` | Read a document file with format detection and section index |
| `adl_write` | Write/create a document file in any format |
| `adl_edit_section` | Replace a specific section in a file by section ID |
| `adl_index` | Generate structural index with headings and token counts |
| `adl_get_section` | Read a section's content with optional overlap context |
| `adl_validate` | Check file structure, encoding, and format compliance |
| `adl_progress` | Check progress of a long-running operation |
| `adl_resume` | Resume an interrupted operation from checkpoint |

## Supported formats

- Plain text (.txt), Markdown (.md), HTML (.html), DOCX (.docx), PDF (.pdf)

## Examples

- **Index a file**: `adl_index` with path → see section structure
- **Rewrite**: `adl_index` → `adl_get_section` (loop) → `adl_edit_section` (loop) → `adl_validate`
- **Summarize**: `adl_index` → `adl_get_section` (loop) → `adl_write` (summary)
- **Translate**: `adl_index` → `adl_get_section` with overlap → `adl_edit_section` → `adl_validate`
- **Convert format**: `adl_read` → `adl_write` (with target format)
