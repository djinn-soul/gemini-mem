import { buildAdditionalContext } from "../memory/retrieve";
import { getMemoryEnvConfig } from "./shared/env";
import { readStdinJson, writeHookOutput } from "./shared/hook-io";
import { createHookRuntimeContext } from "./shared/context";
import type { SessionStartHookInput } from "./shared/types";

async function main(): Promise<void> {
  const input = await readStdinJson<SessionStartHookInput>();

  if (process.env.GEMINI_MEM_INTERNAL === "1") {
    writeHookOutput({});
    return;
  }

  const config = getMemoryEnvConfig();

  if (!config.enableSessionStart) {
    writeHookOutput({});
    return;
  }

  const context = createHookRuntimeContext(config, input);

  try {
    const recent = context.store.getRecentProjectMemories(context.projectId, config.maxInject);

    if (recent.length === 0) {
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
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    context.logger.error(`SessionStart failed: ${message}`);
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
