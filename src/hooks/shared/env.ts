import { homedir } from "node:os";
import { join } from "node:path";
import type { LogLevel, MemoryEnvConfig } from "./types";

function parseIntWithDefault(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseBooleanWithDefault(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) {
    return fallback;
  }

  if (value === "true" || value === "1") {
    return true;
  }

  if (value === "false" || value === "0") {
    return false;
  }

  return fallback;
}

function parseProjectMode(value: string | undefined): "cwd-hash" | "manual" {
  return value === "manual" ? "manual" : "cwd-hash";
}

function parseLogLevel(value: string | undefined): LogLevel {
  if (value === "debug" || value === "info" || value === "warn" || value === "error") {
    return value;
  }

  return "info";
}

function parseJsonStringArray(value: string | undefined): string[] {
  if (!value) {
    return [];
  }

  const parsed = JSON.parse(value);
  if (!Array.isArray(parsed)) {
    throw new Error("MEM_GEMINI_ARGS_JSON must be a JSON array of strings.");
  }

  const values = parsed.filter((item): item is string => typeof item === "string");
  if (values.length !== parsed.length) {
    throw new Error("MEM_GEMINI_ARGS_JSON must contain only string values.");
  }

  return values;
}

export function getMemoryEnvConfig(): MemoryEnvConfig {
  return {
    dbPath: process.env.MEM_DB_PATH ?? join(homedir(), ".gemini", "gemini-mem"),
    hookTelemetry: parseBooleanWithDefault(process.env.MEM_HOOK_TELEMETRY, false),
    maxInject: parseIntWithDefault(process.env.MEM_MAX_INJECT, 5),
    rerankCandidates: parseIntWithDefault(process.env.MEM_RERANK_CANDIDATES, 20),
    enableSessionStart: parseBooleanWithDefault(process.env.MEM_ENABLE_SESSIONSTART, true),
    enableAfterTool: parseBooleanWithDefault(process.env.MEM_ENABLE_AFTERTOOL, false),
    logLevel: parseLogLevel(process.env.MEM_LOG_LEVEL),
    projectMode: parseProjectMode(process.env.MEM_PROJECT_MODE),
    projectId: process.env.MEM_PROJECT_ID ?? "",
    model: process.env.MEM_MODEL ?? "",
    summarizationTimeoutMs: parseIntWithDefault(process.env.MEM_SUMMARIZATION_TIMEOUT_MS, 60000),
    rerankTimeoutMs: parseIntWithDefault(process.env.MEM_RERANK_TIMEOUT_MS, 45000),
    summaryInputChars: parseIntWithDefault(process.env.MEM_SUMMARY_INPUT_CHARS, 4500),
    maxInjectChars: parseIntWithDefault(process.env.MEM_MAX_INJECT_CHARS, 5200),
    geminiCommand: process.env.MEM_GEMINI_COMMAND ?? "gemini",
    geminiArgs: parseJsonStringArray(process.env.MEM_GEMINI_ARGS_JSON)
  };
}
