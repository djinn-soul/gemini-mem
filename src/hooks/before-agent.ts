import { rerankMemoriesWithGemini } from "../gemini/reranker";
import { buildAdditionalContext } from "../memory/retrieve";
import { getMemoryEnvConfig } from "./shared/env";
import { readStdinJson, writeHookOutput } from "./shared/hook-io";
import { createHookRuntimeContext } from "./shared/context";
import { writeHookTelemetry } from "./shared/telemetry";
import type { BeforeAgentHookInput } from "./shared/types";

async function main(): Promise<void> {
  const input = await readStdinJson<BeforeAgentHookInput>();
  const config = getMemoryEnvConfig();
  writeHookTelemetry(config, input, { hook: "BeforeAgent", event: "start" });

  if (process.env.GEMINI_MEM_INTERNAL === "1") {
    writeHookTelemetry(config, input, { hook: "BeforeAgent", event: "skip_internal" });
    writeHookOutput({});
    return;
  }

  const context = createHookRuntimeContext(config, input);

  try {
    const candidates = context.store.searchCandidates(
      context.projectId,
      input.prompt,
      config.rerankCandidates
    );

    if (candidates.length === 0) {
      writeHookTelemetry(config, input, { hook: "BeforeAgent", event: "no_candidates" });
      writeHookOutput({});
      return;
    }

    const selectedIds = await rerankMemoriesWithGemini({
      query: input.prompt,
      candidates,
      maxSelect: config.maxInject,
      timeoutMs: config.rerankTimeoutMs,
      model: config.model,
      command: config.geminiCommand,
      commandArgs: config.geminiArgs
    });

    if (selectedIds.length === 0) {
      writeHookTelemetry(config, input, { hook: "BeforeAgent", event: "no_selected_ids" });
      writeHookOutput({});
      return;
    }

    const selectedMemories = context.store.getMemoriesByIds(context.projectId, selectedIds);

    if (selectedMemories.length === 0) {
      writeHookTelemetry(config, input, { hook: "BeforeAgent", event: "no_selected_memories" });
      writeHookOutput({});
      return;
    }

    const additionalContext = buildAdditionalContext(selectedMemories, config.maxInjectChars);

    writeHookOutput({
      hookSpecificOutput: {
        additionalContext
      }
    });
    writeHookTelemetry(config, input, { hook: "BeforeAgent", event: "context_injected" });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    context.logger.error(`BeforeAgent failed: ${message}`);
    writeHookTelemetry(config, input, { hook: "BeforeAgent", event: "error", message });
    writeHookOutput({});
  } finally {
    context.store.close();
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`[gemini-mem] [error] Unhandled BeforeAgent failure: ${message}\n`);
  writeHookOutput({});
});
