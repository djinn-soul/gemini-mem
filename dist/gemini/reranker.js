"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rerankMemoriesWithGemini = rerankMemoriesWithGemini;
const prompts_1 = require("./prompts");
const json_1 = require("./json");
const gemini_cli_1 = require("../runtime/gemini-cli");
function parseSelectedIds(raw) {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
        throw new Error("Rerank output must be an object.");
    }
    const candidate = raw.selected_ids;
    if (!Array.isArray(candidate)) {
        throw new Error("Rerank output field 'selected_ids' must be an array.");
    }
    if (candidate.length > 20) {
        throw new Error("Rerank output field 'selected_ids' cannot exceed 20 entries.");
    }
    return candidate.map((item, index) => {
        if (typeof item !== "string") {
            throw new Error(`Rerank output field 'selected_ids[${index}]' must be a string.`);
        }
        return item;
    });
}
async function rerankMemoriesWithGemini(input) {
    if (input.candidates.length === 0) {
        return [];
    }
    const prompt = (0, prompts_1.buildRerankPrompt)(input.query, input.candidates, input.maxSelect);
    const rawOutput = await (0, gemini_cli_1.runGeminiPrompt)(prompt, {
        command: input.command,
        baseArgs: input.commandArgs,
        model: input.model,
        timeoutMs: input.timeoutMs
    });
    const selectedIds = parseSelectedIds(JSON.parse((0, json_1.extractJsonObject)(rawOutput)));
    const candidateIdSet = new Set(input.candidates.map((candidate) => candidate.id));
    const selected = selectedIds.filter((id) => candidateIdSet.has(id)).slice(0, input.maxSelect);
    return Array.from(new Set(selected));
}
