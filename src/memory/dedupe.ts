import { createHash } from "node:crypto";
import type { MemoryCard } from "./schema";

function normalizeList(values: string[]): string {
  return values
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value.length > 0)
    .sort()
    .join("|");
}

export function buildDedupeHash(projectId: string, card: MemoryCard): string {
  const payload = [
    projectId,
    card.title.trim().toLowerCase(),
    card.type,
    card.summary.trim().toLowerCase(),
    normalizeList(card.key_facts),
    normalizeList(card.tags),
    normalizeList(card.files)
  ].join("||");

  return createHash("sha256").update(payload).digest("hex");
}
