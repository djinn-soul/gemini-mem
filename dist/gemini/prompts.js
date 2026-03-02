"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildSummarizationPrompt = buildSummarizationPrompt;
exports.buildRerankPrompt = buildRerankPrompt;
function truncate(value, maxChars) {
    if (value.length <= maxChars) {
        return value;
    }
    return `${value.slice(0, maxChars - 3)}...`;
}
function buildSummarizationPrompt(userPrompt, agentResponse, maxChars) {
    const promptPart = truncate(userPrompt.trim(), Math.floor(maxChars * 0.45));
    const responsePart = truncate(agentResponse.trim(), Math.floor(maxChars * 0.55));
    return [
        "You are a memory extraction engine for a coding assistant session.",
        "Return JSON only.",
        "Extract durable information useful for future turns.",
        "Required schema:",
        "{",
        '  "title": string,',
        '  "type": "task"|"decision"|"fact"|"constraint"|"risk"|"other",',
        '  "summary": string,',
        '  "key_facts": string[],',
        '  "tags": string[],',
        '  "files": string[],',
        '  "importance": integer 1..5',
        "}",
        "Rules:",
        "- Use concise technical language.",
        "- Prefer concrete details over generic phrasing.",
        "- Include file paths only if explicitly present.",
        "- Do not include secrets.",
        "",
        "User request:",
        promptPart,
        "",
        "Assistant response:",
        responsePart
    ].join("\n");
}
function buildRerankPrompt(query, candidates, maxSelect) {
    const serializedCandidates = candidates
        .map((candidate, index) => {
        return [
            `#${index + 1}`,
            `id: ${candidate.id}`,
            `title: ${candidate.title}`,
            `type: ${candidate.type}`,
            `summary: ${candidate.summary}`,
            `tags: ${candidate.tags.join(", ")}`,
            `importance: ${candidate.importance}`
        ].join("\n");
    })
        .join("\n\n");
    return [
        "You rank candidate memories for relevance to a new user query.",
        "Return JSON only.",
        "Schema:",
        `{ "selected_ids": string[] }`,
        `Select up to ${maxSelect} ids in descending relevance order.`,
        "Prefer memories that preserve constraints, decisions, active tasks, and file-specific context.",
        "",
        "User query:",
        query.trim(),
        "",
        "Candidate memories:",
        serializedCandidates
    ].join("\n");
}
