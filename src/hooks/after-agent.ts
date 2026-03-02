import { randomUUID } from "node:crypto";
import { appendFileSync } from "node:fs";
import { summarizeTurnWithGemini } from "../gemini/summarizer";
import { buildDedupeHash } from "../memory/dedupe";
import { redactMemoryCard } from "../memory/redact";
import { getMemoryEnvConfig } from "./shared/env";
import { readStdinJson, writeHookOutput } from "./shared/hook-io";
import { createHookRuntimeContext } from "./shared/context";
import { writeHookTelemetry } from "./shared/telemetry";
import type { AfterAgentHookInput } from "./shared/types";

function isMemCommandPrompt(prompt: string): boolean {
  return /^\/mem(?::|$)/i.test(prompt.trim());
}

function writeDebugTrace(payload: Record<string, unknown>): void {
  const path = process.env.MEM_DEBUG_HOOK_FILE;
  if (!path) {
    return;
  }

  appendFileSync(path, `${JSON.stringify(payload)}\n`, { encoding: "utf8" });
}

async function main(): Promise<void> {
  const input = await readStdinJson<AfterAgentHookInput>();
  const inputRecord = input as unknown as Record<string, unknown>;
  writeDebugTrace({
    ts: new Date().toISOString(),
    stage: "start",
    hook_event_name: inputRecord.hook_event_name ?? "",
    has_prompt: typeof input.prompt === "string" && input.prompt.length > 0,
    has_prompt_response: typeof input.prompt_response === "string" && input.prompt_response.length > 0,
    gemini_mem_internal: process.env.GEMINI_MEM_INTERNAL ?? ""
  });

  const config = getMemoryEnvConfig();
  writeHookTelemetry(config, input, { hook: "AfterAgent", event: "start" });

  if (process.env.GEMINI_MEM_INTERNAL === "1") {
    writeHookTelemetry(config, input, { hook: "AfterAgent", event: "skip_internal" });
    writeDebugTrace({
      ts: new Date().toISOString(),
      stage: "skip_internal"
    });
    writeHookOutput({});
    return;
  }

  if (isMemCommandPrompt(input.prompt ?? "")) {
    writeHookTelemetry(config, input, { hook: "AfterAgent", event: "skip_mem_command" });
    writeDebugTrace({
      ts: new Date().toISOString(),
      stage: "skip_mem_command",
      prompt: input.prompt
    });
    writeHookOutput({});
    return;
  }

  const context = createHookRuntimeContext(config, input);

  try {
    const card = await summarizeTurnWithGemini({
      prompt: input.prompt,
      response: input.prompt_response,
      model: config.model,
      command: config.geminiCommand,
      commandArgs: config.geminiArgs,
      maxChars: config.summaryInputChars,
      timeoutMs: config.summarizationTimeoutMs
    });

    const redactedCard = redactMemoryCard(card);
    const dedupeHash = buildDedupeHash(context.projectId, redactedCard);

    const inserted = context.store.insertMemory({
      id: randomUUID(),
      ts: input.timestamp ?? new Date().toISOString(),
      project_id: context.projectId,
      session_id: input.session_id ?? "unknown",
      dedupe_hash: dedupeHash,
      source_hook: "AfterAgent",
      card: redactedCard
    });

    if (inserted) {
      context.logger.debug("Stored memory from AfterAgent event.");
      writeHookTelemetry(config, input, { hook: "AfterAgent", event: "stored" });
      writeDebugTrace({
        ts: new Date().toISOString(),
        stage: "stored",
        inserted: true
      });
    } else {
      context.logger.debug("Skipped duplicate memory from AfterAgent event.");
      writeHookTelemetry(config, input, { hook: "AfterAgent", event: "duplicate" });
      writeDebugTrace({
        ts: new Date().toISOString(),
        stage: "stored",
        inserted: false
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    context.logger.error(`AfterAgent failed: ${message}`);
    writeHookTelemetry(config, input, { hook: "AfterAgent", event: "error", message });
    writeDebugTrace({
      ts: new Date().toISOString(),
      stage: "error",
      message
    });
  } finally {
    context.store.close();
  }

  writeHookOutput({});
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`[gemini-mem] [error] Unhandled AfterAgent failure: ${message}\n`);
  writeHookOutput({});
});
