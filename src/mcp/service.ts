import { randomUUID } from "node:crypto";
import { getMemoryEnvConfig } from "../hooks/shared/env";
import { resolveMemoryDbPath } from "../memory/db-path";
import { buildDedupeHash } from "../memory/dedupe";
import { resolveProjectId } from "../memory/project-id";
import { redactMemoryCard } from "../memory/redact";
import { parseMemoryCard } from "../memory/schema";
import { SqliteMemoryStore } from "../memory/store";

type JsonObject = Record<string, unknown>;

const MAX_LIMIT = 50;
const MEMORY_TYPES = new Set(["task", "decision", "fact", "constraint", "risk", "other"]);

function readString(input: JsonObject, key: string, required = false): string {
  const value = input[key];
  if (value === undefined || value === null) {
    if (required) {
      throw new Error(`${key} is required.`);
    }
    return "";
  }

  if (typeof value !== "string") {
    throw new Error(`${key} must be a string.`);
  }

  return value.trim();
}

function readStringArray(input: JsonObject, key: string): string[] {
  const value = input[key];
  if (value === undefined || value === null) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new Error(`${key} must be an array of strings.`);
  }

  const values = value.map((item, index) => {
    if (typeof item !== "string") {
      throw new Error(`${key}[${index}] must be a string.`);
    }
    return item.trim();
  });

  return values.filter((entry) => entry.length > 0);
}

function readInt(input: JsonObject, key: string, fallback: number, min: number, max: number): number {
  const value = input[key];
  if (value === undefined || value === null) {
    return fallback;
  }

  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new Error(`${key} must be an integer.`);
  }

  if (value < min || value > max) {
    throw new Error(`${key} must be between ${min} and ${max}.`);
  }

  return value;
}

function stripPrivateSegments(text: string): string {
  return text.replace(/<private>[\s\S]*?<\/private>/gi, "[REDACTED_PRIVATE]");
}

interface ProjectScope {
  cwd: string;
  projectId: string;
  dbPath: string;
}

export class MemoryMcpService {
  resolveScope(input: JsonObject): ProjectScope {
    const config = getMemoryEnvConfig();
    const cwd = readString(input, "project_cwd") || process.cwd();
    const explicitProjectId = readString(input, "project_id");

    const projectId =
      explicitProjectId ||
      resolveProjectId({
        cwd,
        mode: config.projectMode,
        manualProjectId: config.projectId
      });

    return {
      cwd,
      projectId,
      dbPath: resolveMemoryDbPath(config.dbPath, cwd)
    };
  }

  memoryStatus(input: JsonObject): JsonObject {
    const scope = this.resolveScope(input);
    const store = new SqliteMemoryStore(scope.dbPath);

    try {
      return {
        projectId: scope.projectId,
        ...store.stats(scope.projectId)
      };
    } finally {
      store.close();
    }
  }

  memorySearch(input: JsonObject): JsonObject {
    const scope = this.resolveScope(input);
    const query = readString(input, "query", true);
    const limit = readInt(input, "limit", 10, 1, MAX_LIMIT);
    const store = new SqliteMemoryStore(scope.dbPath);

    try {
      const items = store.searchCandidates(scope.projectId, query, limit).map((item) => ({
        id: item.id,
        ts: item.ts,
        title: item.title,
        type: item.type,
        summary: item.summary,
        key_facts: item.key_facts,
        tags: item.tags,
        files: item.files,
        importance: item.importance,
        source_hook: item.source_hook
      }));

      return {
        projectId: scope.projectId,
        query,
        count: items.length,
        items
      };
    } finally {
      store.close();
    }
  }

  memoryGetContext(input: JsonObject): JsonObject {
    const config = getMemoryEnvConfig();
    const scope = this.resolveScope(input);
    const query = readString(input, "query");
    const maxItems = readInt(input, "max_items", config.maxInject, 1, 20);
    const maxChars = readInt(input, "max_chars", config.maxInjectChars, 300, 12000);
    const store = new SqliteMemoryStore(scope.dbPath);

    try {
      const candidates = store.searchCandidates(scope.projectId, query, Math.max(maxItems * 3, maxItems));
      const selected = candidates.slice(0, maxItems);
      const lines: string[] = [];
      const citations: Array<{ id: string; title: string; ts: string }> = [];

      lines.push(`Memory context for project ${scope.projectId}:`);
      for (const memory of selected) {
        const line = `[${memory.id}] ${memory.title} | ${memory.type} | importance ${memory.importance}\nSummary: ${memory.summary}`;
        if ((lines.join("\n").length + line.length + 1) > maxChars) {
          break;
        }
        lines.push(line);
        citations.push({ id: memory.id, title: memory.title, ts: memory.ts });
      }

      return {
        projectId: scope.projectId,
        query,
        context: lines.join("\n\n"),
        citations
      };
    } finally {
      store.close();
    }
  }

  memorySaveObservation(input: JsonObject): JsonObject {
    const scope = this.resolveScope(input);
    const title = readString(input, "title", true);
    const summary = stripPrivateSegments(readString(input, "summary", true));
    const type = readString(input, "type") || "fact";
    const keyFacts = readStringArray(input, "key_facts");
    const tags = readStringArray(input, "tags");
    const files = readStringArray(input, "files");
    const importance = readInt(input, "importance", 3, 1, 5);
    const sessionId = readString(input, "session_id") || "mcp-session";
    const sourceHook = readString(input, "source_hook") || "MCP";

    if (!MEMORY_TYPES.has(type)) {
      throw new Error("type must be one of: task, decision, fact, constraint, risk, other.");
    }

    const card = parseMemoryCard({
      title,
      type,
      summary,
      key_facts: keyFacts.length > 0 ? keyFacts : [summary.slice(0, 180)],
      tags,
      files,
      importance
    });
    const redactedCard = redactMemoryCard(card);
    const dedupeHash = buildDedupeHash(scope.projectId, redactedCard);

    const store = new SqliteMemoryStore(scope.dbPath);
    try {
      const id = randomUUID();
      const inserted = store.insertMemory({
        id,
        ts: new Date().toISOString(),
        project_id: scope.projectId,
        session_id: sessionId,
        dedupe_hash: dedupeHash,
        source_hook: sourceHook,
        card: redactedCard
      });

      return {
        projectId: scope.projectId,
        inserted,
        id: inserted ? id : null
      };
    } finally {
      store.close();
    }
  }

  memoryCite(input: JsonObject): JsonObject {
    const scope = this.resolveScope(input);
    const id = readString(input, "id", true);
    const store = new SqliteMemoryStore(scope.dbPath);

    try {
      const memory = store.getMemoriesByIds(scope.projectId, [id])[0];
      if (!memory) {
        throw new Error(`No memory found for id ${id}.`);
      }

      return {
        projectId: scope.projectId,
        memory
      };
    } finally {
      store.close();
    }
  }

  memoryEndSession(input: JsonObject): JsonObject {
    const summary = readString(input, "summary", true);
    const sessionId = readString(input, "session_id") || "mcp-session";
    const title = readString(input, "title") || `Session ${sessionId} summary`;
    const tags = readStringArray(input, "tags");
    const files = readStringArray(input, "files");
    const keyFacts = readStringArray(input, "key_facts");

    return this.memorySaveObservation({
      ...input,
      title,
      summary,
      type: "fact",
      session_id: sessionId,
      tags: Array.from(new Set([...tags, "session-end"])),
      files,
      key_facts: keyFacts.length > 0 ? keyFacts : [summary.slice(0, 180)],
      source_hook: "MCP:SessionEnd"
    });
  }
}
