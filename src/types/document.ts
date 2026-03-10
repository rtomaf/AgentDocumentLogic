export type DocumentFormat = "plaintext" | "markdown" | "docx" | "pdf" | "html";

export interface DocumentMeta {
  path: string;
  format: DocumentFormat;
  sizeBytes: number;
  estimatedTokens: number;
  title?: string;
  author?: string;
  createdAt?: string;
  modifiedAt?: string;
}

export interface Section {
  id: string;
  index: number;
  heading?: string;
  level: number;
  startOffset: number;
  endOffset: number;
  tokenCount: number;
  content: string;
  children: string[];
  parentId?: string;
}

export interface DocumentIndex {
  documentId: string;
  meta: DocumentMeta;
  sections: Section[];
  totalTokens: number;
  treeDepth: number;
  generatedAt: string;
}

export interface Chunk {
  sectionIds: string[];
  content: string;
  tokenCount: number;
  overlapBefore: string;
  overlapAfter: string;
  chunkIndex: number;
  totalChunks: number;
}
