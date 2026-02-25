export type LogLevel = "debug" | "info" | "warn" | "error";

export interface HookOutput {
  hookSpecificOutput?: {
    additionalContext?: string;
  };
}

export interface HookInputBase {
  cwd?: string;
  session_id?: string;
  timestamp?: string;
}

export interface AfterAgentHookInput extends HookInputBase {
  prompt: string;
  prompt_response: string;
}

export interface BeforeAgentHookInput extends HookInputBase {
  prompt: string;
}

export interface SessionStartHookInput extends HookInputBase {
  source?: string;
}

export interface MemoryEnvConfig {
  dbPath: string;
  maxInject: number;
  rerankCandidates: number;
  enableSessionStart: boolean;
  enableAfterTool: boolean;
  logLevel: LogLevel;
  projectMode: "cwd-hash" | "manual";
  projectId: string;
  model: string;
  summarizationTimeoutMs: number;
  rerankTimeoutMs: number;
  summaryInputChars: number;
  maxInjectChars: number;
  geminiCommand: string;
  geminiArgs: string[];
}
