import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { basename, dirname, isAbsolute, join } from "node:path";
import { runCommand } from "./process";

export interface GeminiPromptOptions {
  command: string;
  baseArgs: string[];
  model: string;
  timeoutMs: number;
}

interface ResolvedCommand {
  command: string;
  args: string[];
}

function getWindowsGeminiEntrypointCandidates(command: string): string[] {
  const candidates: string[] = [];

  if (isAbsolute(command)) {
    candidates.push(command);
  }

  const whereCmd = spawnSync("where", ["gemini.cmd"], { encoding: "utf8" });
  if (whereCmd.status === 0 && whereCmd.stdout) {
    for (const line of whereCmd.stdout.split(/\r?\n/)) {
      const value = line.trim();
      if (value.length > 0) {
        candidates.push(value);
      }
    }
  }

  return Array.from(new Set(candidates));
}

function resolveGeminiCommand(command: string, args: string[]): ResolvedCommand {
  if (process.platform !== "win32") {
    return { command, args };
  }

  const base = basename(command).toLowerCase();
  const isGeminiShim = base === "gemini" || base === "gemini.cmd" || base === "gemini.ps1";

  if (!isGeminiShim) {
    return { command, args };
  }

  const cmdCandidates = getWindowsGeminiEntrypointCandidates(command);

  for (const cmdPath of cmdCandidates) {
    const base = dirname(cmdPath);
    // Try known entrypoint locations in order of preference (newer builds first)
    const candidates = [
      join(base, "node_modules", "@google", "gemini-cli", "bundle", "gemini.js"),
      join(base, "node_modules", "@google", "gemini-cli", "dist", "index.js")
    ];
    for (const geminiJsPath of candidates) {
      if (existsSync(geminiJsPath)) {
        return {
          command: process.execPath,
          args: ["--no-warnings=DEP0040", geminiJsPath, ...args]
        };
      }
    }
  }

  return { command, args };
}

export async function runGeminiPrompt(prompt: string, options: GeminiPromptOptions): Promise<string> {
  const args: string[] = [...options.baseArgs];

  if (options.model) {
    args.push("--model", options.model);
  }

  args.push("-p", prompt);

  const resolved = resolveGeminiCommand(options.command, args);

  const result = await runCommand(resolved.command, resolved.args, {
    input: undefined,
    timeoutMs: options.timeoutMs,
    env: {
      ...process.env,
      GEMINI_MEM_INTERNAL: "1"
    }
  });

  if (result.exitCode !== 0) {
    throw new Error(`Gemini command failed (${result.exitCode}): ${result.stderr}`);
  }

  if (!result.stdout) {
    throw new Error("Gemini command returned empty stdout.");
  }

  return result.stdout;
}
