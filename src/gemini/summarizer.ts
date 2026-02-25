import { parseMemoryCard, type MemoryCard } from "../memory/schema";
import { buildSummarizationPrompt } from "./prompts";
import { extractJsonObject } from "./json";
import { runGeminiPrompt } from "../runtime/gemini-cli";

export interface SummarizeTurnInput {
  prompt: string;
  response: string;
  model: string;
  command: string;
  commandArgs: string[];
  maxChars: number;
  timeoutMs: number;
}

export async function summarizeTurnWithGemini(input: SummarizeTurnInput): Promise<MemoryCard> {
  const prompt = buildSummarizationPrompt(input.prompt, input.response, input.maxChars);
  const rawOutput = await runGeminiPrompt(prompt, {
    command: input.command,
    baseArgs: input.commandArgs,
    model: input.model,
    timeoutMs: input.timeoutMs
  });

  const parsed = JSON.parse(extractJsonObject(rawOutput));
  return parseMemoryCard(parsed);
}
