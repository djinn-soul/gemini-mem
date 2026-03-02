"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.summarizeTurnWithGemini = summarizeTurnWithGemini;
const schema_1 = require("../memory/schema");
const prompts_1 = require("./prompts");
const json_1 = require("./json");
const gemini_cli_1 = require("../runtime/gemini-cli");
async function summarizeTurnWithGemini(input) {
    const prompt = (0, prompts_1.buildSummarizationPrompt)(input.prompt, input.response, input.maxChars);
    const rawOutput = await (0, gemini_cli_1.runGeminiPrompt)(prompt, {
        command: input.command,
        baseArgs: input.commandArgs,
        model: input.model,
        timeoutMs: input.timeoutMs
    });
    const parsed = JSON.parse((0, json_1.extractJsonObject)(rawOutput));
    return (0, schema_1.parseMemoryCard)(parsed);
}
