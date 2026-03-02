"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const reranker_1 = require("../gemini/reranker");
const retrieve_1 = require("../memory/retrieve");
const env_1 = require("./shared/env");
const hook_io_1 = require("./shared/hook-io");
const context_1 = require("./shared/context");
async function main() {
    const input = await (0, hook_io_1.readStdinJson)();
    if (process.env.GEMINI_MEM_INTERNAL === "1") {
        (0, hook_io_1.writeHookOutput)({});
        return;
    }
    const config = (0, env_1.getMemoryEnvConfig)();
    const context = (0, context_1.createHookRuntimeContext)(config, input);
    try {
        const candidates = context.store.searchCandidates(context.projectId, input.prompt, config.rerankCandidates);
        if (candidates.length === 0) {
            (0, hook_io_1.writeHookOutput)({});
            return;
        }
        const selectedIds = await (0, reranker_1.rerankMemoriesWithGemini)({
            query: input.prompt,
            candidates,
            maxSelect: config.maxInject,
            timeoutMs: config.rerankTimeoutMs,
            model: config.model,
            command: config.geminiCommand,
            commandArgs: config.geminiArgs
        });
        if (selectedIds.length === 0) {
            (0, hook_io_1.writeHookOutput)({});
            return;
        }
        const selectedMemories = context.store.getMemoriesByIds(context.projectId, selectedIds);
        if (selectedMemories.length === 0) {
            (0, hook_io_1.writeHookOutput)({});
            return;
        }
        const additionalContext = (0, retrieve_1.buildAdditionalContext)(selectedMemories, config.maxInjectChars);
        (0, hook_io_1.writeHookOutput)({
            hookSpecificOutput: {
                additionalContext
            }
        });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        context.logger.error(`BeforeAgent failed: ${message}`);
        (0, hook_io_1.writeHookOutput)({});
    }
    finally {
        context.store.close();
    }
}
main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`[gemini-mem] [error] Unhandled BeforeAgent failure: ${message}\n`);
    (0, hook_io_1.writeHookOutput)({});
});
