import { createHash } from "node:crypto";

export function sha256(content: string): string {
  return createHash("sha256").update(content, "utf-8").digest("hex");
}

export function shortHash(content: string, length = 12): string {
  return sha256(content).slice(0, length);
}
