import { buildAdditionalContext } from "../memory/retrieve";
import { getMemoryEnvConfig } from "./shared/env";
import { readStdinJson, writeHookOutput } from "./shared/hook-io";
import { createHookRuntimeContext } from "./shared/context";
import { writeHookTelemetry } from "./shared/telemetry";
import type { SessionStartHookInput } from "./shared/types";

async function main(): Promise<void> {
  const input = await readStdinJson<SessionStartHookInput>();
  const config = getMemoryEnvConfig();
  writeHookTelemetry(config, input, { hook: "SessionStart", event: "start" });

  if (process.env.GEMINI_MEM_INTERNAL === "1") {
    writeHookTelemetry(config, input, { hook: "SessionStart", event: "skip_internal" });
    writeHookOutput({});
    return;
  }

  if (!config.enableSessionStart) {
    writeHookTelemetry(config, input, { hook: "SessionStart", event: "disabled" });
    writeHookOutput({});
    return;
  }

  const context = createHookRuntimeContext(config, input);

  try {
    const recent = context.store.getRecentProjectMemories(context.projectId, config.maxInject);

    if (recent.length === 0) {
      writeHookTelemetry(config, input, { hook: "SessionStart", event: "no_memories" });
      writeHookOutput({});
      return;
    }

    const additionalContext = [
      "Project baseline memory:",
      buildAdditionalContext(recent, config.maxInjectChars)
    ].join("\n");

    writeHookOutput({
      hookSpecificOutput: {
        additionalContext
      }
    });
    writeHookTelemetry(config, input, { hook: "SessionStart", event: "context_injected" });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    context.logger.error(`SessionStart failed: ${message}`);
    writeHookTelemetry(config, input, { hook: "SessionStart", event: "error", message });
    writeHookOutput({});
  } finally {
    context.store.close();
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`[gemini-mem] [error] Unhandled SessionStart failure: ${message}\n`);
  writeHookOutput({});
});
