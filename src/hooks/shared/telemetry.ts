import { appendFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { resolveMemoryDbPath } from "../../memory/db-path";
import { resolveProjectId } from "../../memory/project-id";
import type { HookInputBase, MemoryEnvConfig } from "./types";

interface HookTelemetryEvent {
  hook: "AfterAgent" | "BeforeAgent" | "SessionStart";
  event: string;
  message?: string;
}

export function writeHookTelemetry(
  config: MemoryEnvConfig,
  input: HookInputBase,
  payload: HookTelemetryEvent
): void {
  if (!config.hookTelemetry) {
    return;
  }

  try {
    const cwd = input.cwd ?? process.cwd();
    const projectId = resolveProjectId({
      cwd,
      mode: config.projectMode,
      manualProjectId: config.projectId
    });
    const dbPath = resolveMemoryDbPath(config.dbPath, cwd);
    const logPath = join(dirname(dbPath), "hook.log");
    mkdirSync(dirname(logPath), { recursive: true });

    const line = {
      ts: input.timestamp ?? new Date().toISOString(),
      hook: payload.hook,
      event: payload.event,
      projectId,
      sessionId: input.session_id ?? null,
      message: payload.message ?? null
    };

    appendFileSync(logPath, `${JSON.stringify(line)}\n`, { encoding: "utf8" });
  } catch {
    // Telemetry is best-effort and must never break hook execution.
  }
}
