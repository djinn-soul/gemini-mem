import type { StoredMemory } from "../memory/schema";
import { buildRerankPrompt } from "./prompts";
import { extractJsonObject } from "./json";
import { runGeminiPrompt } from "../runtime/gemini-cli";

export interface RerankInput {
  query: string;
  candidates: StoredMemory[];
  maxSelect: number;
  timeoutMs: number;
  model: string;
  command: string;
  commandArgs: string[];
}

function parseSelectedIds(raw: unknown): string[] {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new Error("Rerank output must be an object.");
  }

  const candidate = (raw as { selected_ids?: unknown }).selected_ids;
  if (!Array.isArray(candidate)) {
    throw new Error("Rerank output field 'selected_ids' must be an array.");
  }

  if (candidate.length > 20) {
    throw new Error("Rerank output field 'selected_ids' cannot exceed 20 entries.");
  }

  return candidate.map((item, index) => {
    if (typeof item !== "string") {
      throw new Error(`Rerank output field 'selected_ids[${index}]' must be a string.`);
    }

    return item;
  });
}

export async function rerankMemoriesWithGemini(input: RerankInput): Promise<string[]> {
  if (input.candidates.length === 0) {
    return [];
  }

  const prompt = buildRerankPrompt(input.query, input.candidates, input.maxSelect);
  const rawOutput = await runGeminiPrompt(prompt, {
    command: input.command,
    baseArgs: input.commandArgs,
    model: input.model,
    timeoutMs: input.timeoutMs
  });

  const selectedIds = parseSelectedIds(JSON.parse(extractJsonObject(rawOutput)));
  const candidateIdSet = new Set(input.candidates.map((candidate) => candidate.id));

  const selected = selectedIds.filter((id) => candidateIdSet.has(id)).slice(0, input.maxSelect);
  return Array.from(new Set(selected));
}
