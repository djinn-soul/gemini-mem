"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const retrieve_1 = require("../memory/retrieve");
const env_1 = require("./shared/env");
const hook_io_1 = require("./shared/hook-io");
const context_1 = require("./shared/context");
const telemetry_1 = require("./shared/telemetry");
async function main() {
    const input = await (0, hook_io_1.readStdinJson)();
    const config = (0, env_1.getMemoryEnvConfig)();
    (0, telemetry_1.writeHookTelemetry)(config, input, { hook: "SessionStart", event: "start" });
    if (process.env.GEMINI_MEM_INTERNAL === "1") {
        (0, telemetry_1.writeHookTelemetry)(config, input, { hook: "SessionStart", event: "skip_internal" });
        (0, hook_io_1.writeHookOutput)({});
        return;
    }
    if (!config.enableSessionStart) {
        (0, telemetry_1.writeHookTelemetry)(config, input, { hook: "SessionStart", event: "disabled" });
        (0, hook_io_1.writeHookOutput)({});
        return;
    }
    const context = (0, context_1.createHookRuntimeContext)(config, input);
    try {
        const recent = context.store.getRecentProjectMemories(context.projectId, config.maxInject);
        if (recent.length === 0) {
            (0, telemetry_1.writeHookTelemetry)(config, input, { hook: "SessionStart", event: "no_memories" });
            (0, hook_io_1.writeHookOutput)({});
            return;
        }
        const additionalContext = [
            "Project baseline memory:",
            (0, retrieve_1.buildAdditionalContext)(recent, config.maxInjectChars)
        ].join("\n");
        (0, hook_io_1.writeHookOutput)({
            hookSpecificOutput: {
                additionalContext
            }
        });
        (0, telemetry_1.writeHookTelemetry)(config, input, { hook: "SessionStart", event: "context_injected" });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        context.logger.error(`SessionStart failed: ${message}`);
        (0, telemetry_1.writeHookTelemetry)(config, input, { hook: "SessionStart", event: "error", message });
        (0, hook_io_1.writeHookOutput)({});
    }
    finally {
        context.store.close();
    }
}
main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`[gemini-mem] [error] Unhandled SessionStart failure: ${message}\n`);
    (0, hook_io_1.writeHookOutput)({});
});
