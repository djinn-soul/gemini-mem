import type { StoredMemory } from "./schema";

export function buildAdditionalContext(memories: StoredMemory[], maxChars: number): string {
  const lines: string[] = ["Persistent memory context (most relevant first):"];

  for (const memory of memories) {
    lines.push(`- [${memory.type}] ${memory.title}`);
    lines.push(`  Summary: ${memory.summary}`);

    if (memory.key_facts.length > 0) {
      lines.push(`  Facts: ${memory.key_facts.join("; ")}`);
    }

    if (memory.files.length > 0) {
      lines.push(`  Files: ${memory.files.join(", ")}`);
    }

    lines.push(`  Importance: ${memory.importance}/5`);
  }

  const combined = lines.join("\n");
  if (combined.length <= maxChars) {
    return combined;
  }

  return `${combined.slice(0, maxChars - 3)}...`;
}

export function parseSearchTerms(prompt: string): string[] {
  return Array.from(
    new Set(
      prompt
        .toLowerCase()
        .split(/[^a-z0-9_\-/]+/)
        .map((value) => value.trim())
        .filter((value) => value.length >= 3)
        .slice(0, 12)
    )
  );
}

export function toFtsQuery(terms: string[]): string {
  if (terms.length === 0) {
    return "";
  }

  return terms
    .map((term) => {
      // Quote terms containing FTS5 special characters (hyphens, slashes, etc.)
      // to prevent them being interpreted as operators or column references
      const needsQuoting = /[^a-z0-9_]/.test(term);
      return needsQuoting ? `"${term}"*` : `${term}*`;
    })
    .join(" OR ");
}
