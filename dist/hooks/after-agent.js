"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_crypto_1 = require("node:crypto");
const node_fs_1 = require("node:fs");
const summarizer_1 = require("../gemini/summarizer");
const dedupe_1 = require("../memory/dedupe");
const redact_1 = require("../memory/redact");
const env_1 = require("./shared/env");
const hook_io_1 = require("./shared/hook-io");
const context_1 = require("./shared/context");
function isMemCommandPrompt(prompt) {
    return /^\/mem(?::|$)/i.test(prompt.trim());
}
function writeDebugTrace(payload) {
    const path = process.env.MEM_DEBUG_HOOK_FILE;
    if (!path) {
        return;
    }
    (0, node_fs_1.appendFileSync)(path, `${JSON.stringify(payload)}\n`, { encoding: "utf8" });
}
async function main() {
    const input = await (0, hook_io_1.readStdinJson)();
    const inputRecord = input;
    writeDebugTrace({
        ts: new Date().toISOString(),
        stage: "start",
        hook_event_name: inputRecord.hook_event_name ?? "",
        has_prompt: typeof input.prompt === "string" && input.prompt.length > 0,
        has_prompt_response: typeof input.prompt_response === "string" && input.prompt_response.length > 0,
        gemini_mem_internal: process.env.GEMINI_MEM_INTERNAL ?? ""
    });
    if (process.env.GEMINI_MEM_INTERNAL === "1") {
        writeDebugTrace({
            ts: new Date().toISOString(),
            stage: "skip_internal"
        });
        (0, hook_io_1.writeHookOutput)({});
        return;
    }
    if (isMemCommandPrompt(input.prompt ?? "")) {
        writeDebugTrace({
            ts: new Date().toISOString(),
            stage: "skip_mem_command",
            prompt: input.prompt
        });
        (0, hook_io_1.writeHookOutput)({});
        return;
    }
    const config = (0, env_1.getMemoryEnvConfig)();
    const context = (0, context_1.createHookRuntimeContext)(config, input);
    try {
        const card = await (0, summarizer_1.summarizeTurnWithGemini)({
            prompt: input.prompt,
            response: input.prompt_response,
            model: config.model,
            command: config.geminiCommand,
            commandArgs: config.geminiArgs,
            maxChars: config.summaryInputChars,
            timeoutMs: config.summarizationTimeoutMs
        });
        const redactedCard = (0, redact_1.redactMemoryCard)(card);
        const dedupeHash = (0, dedupe_1.buildDedupeHash)(context.projectId, redactedCard);
        const inserted = context.store.insertMemory({
            id: (0, node_crypto_1.randomUUID)(),
            ts: input.timestamp ?? new Date().toISOString(),
            project_id: context.projectId,
            session_id: input.session_id ?? "unknown",
            dedupe_hash: dedupeHash,
            source_hook: "AfterAgent",
            card: redactedCard
        });
        if (inserted) {
            context.logger.debug("Stored memory from AfterAgent event.");
            writeDebugTrace({
                ts: new Date().toISOString(),
                stage: "stored",
                inserted: true
            });
        }
        else {
            context.logger.debug("Skipped duplicate memory from AfterAgent event.");
            writeDebugTrace({
                ts: new Date().toISOString(),
                stage: "stored",
                inserted: false
            });
        }
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        context.logger.error(`AfterAgent failed: ${message}`);
        writeDebugTrace({
            ts: new Date().toISOString(),
            stage: "error",
            message
        });
    }
    finally {
        context.store.close();
    }
    (0, hook_io_1.writeHookOutput)({});
}
main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`[gemini-mem] [error] Unhandled AfterAgent failure: ${message}\n`);
    (0, hook_io_1.writeHookOutput)({});
});
