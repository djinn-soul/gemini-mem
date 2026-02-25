const MEMORY_TYPES = ["task", "decision", "fact", "constraint", "risk", "other"] as const;

export type MemoryType = (typeof MEMORY_TYPES)[number];

export interface MemoryCard {
  title: string;
  type: MemoryType;
  summary: string;
  key_facts: string[];
  tags: string[];
  files: string[];
  importance: number;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Memory card must be an object.");
  }

  return value as Record<string, unknown>;
}

function parseString(
  input: Record<string, unknown>,
  key: string,
  minLength: number,
  maxLength: number
): string {
  const value = input[key];
  if (typeof value !== "string") {
    throw new Error(`Memory card field '${key}' must be a string.`);
  }

  const trimmed = value.trim();
  if (trimmed.length < minLength || trimmed.length > maxLength) {
    throw new Error(
      `Memory card field '${key}' must be ${minLength}-${maxLength} characters.`
    );
  }

  return trimmed;
}

function parseStringArray(
  input: Record<string, unknown>,
  key: string,
  minItems: number,
  maxItems: number,
  minLength: number,
  maxLength: number
): string[] {
  const value = input[key];
  if (!Array.isArray(value)) {
    throw new Error(`Memory card field '${key}' must be an array.`);
  }

  if (value.length < minItems || value.length > maxItems) {
    throw new Error(`Memory card field '${key}' must contain ${minItems}-${maxItems} items.`);
  }

  const normalized = value.map((item, index) => {
    if (typeof item !== "string") {
      throw new Error(`Memory card field '${key}[${index}]' must be a string.`);
    }

    const trimmed = item.trim();
    if (trimmed.length < minLength || trimmed.length > maxLength) {
      throw new Error(
        `Memory card field '${key}[${index}]' must be ${minLength}-${maxLength} characters.`
      );
    }

    return trimmed;
  });

  return Array.from(new Set(normalized));
}

function parseMemoryType(input: Record<string, unknown>): MemoryType {
  const value = input.type;
  if (typeof value !== "string" || !MEMORY_TYPES.includes(value as MemoryType)) {
    throw new Error("Memory card field 'type' must be a valid memory type.");
  }

  return value as MemoryType;
}

function parseImportance(input: Record<string, unknown>): number {
  const value = input.importance;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 5) {
    throw new Error("Memory card field 'importance' must be an integer between 1 and 5.");
  }

  return value;
}

export function parseMemoryCard(value: unknown): MemoryCard {
  const input = asRecord(value);

  return {
    title: parseString(input, "title", 3, 160),
    type: parseMemoryType(input),
    summary: parseString(input, "summary", 12, 1200),
    key_facts: parseStringArray(input, "key_facts", 1, 10, 2, 220),
    tags: parseStringArray(input, "tags", 0, 12, 2, 50),
    files: parseStringArray(input, "files", 0, 20, 1, 260),
    importance: parseImportance(input)
  };
}

export interface StoredMemory extends MemoryCard {
  id: string;
  ts: string;
  project_id: string;
  session_id: string;
  dedupe_hash: string;
  source_hook: string;
}

export interface MemoryStats {
  dbPath: string;
  totalMemories: number;
  lastWriteTs: string | null;
  topTags: Array<{ tag: string; count: number }>;
}
