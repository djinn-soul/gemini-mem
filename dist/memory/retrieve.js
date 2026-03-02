"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildAdditionalContext = buildAdditionalContext;
exports.parseSearchTerms = parseSearchTerms;
exports.toFtsQuery = toFtsQuery;
function buildAdditionalContext(memories, maxChars) {
    const lines = ["Persistent memory context (most relevant first):"];
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
function parseSearchTerms(prompt) {
    return Array.from(new Set(prompt
        .toLowerCase()
        .split(/[^a-z0-9_\-/]+/)
        .map((value) => value.trim())
        .filter((value) => value.length >= 3)
        .slice(0, 12)));
}
function toFtsQuery(terms) {
    if (terms.length === 0) {
        return "";
    }
    return terms.map((term) => `${term}*`).join(" OR ");
}
