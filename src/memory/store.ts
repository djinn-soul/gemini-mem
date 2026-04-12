import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";
import type { MemoryCard, MemoryStats, StoredMemory } from "./schema";
import { parseSearchTerms, toFtsQuery } from "./retrieve";

interface MemoryInsertInput {
  id: string;
  ts: string;
  project_id: string;
  session_id: string;
  dedupe_hash: string;
  source_hook: string;
  card: MemoryCard;
}

interface MemoryRow {
  id: string;
  ts: string;
  project_id: string;
  session_id: string;
  title: string;
  type: string;
  summary: string;
  key_facts_json: string;
  tags_json: string;
  files_json: string;
  importance: number;
  dedupe_hash: string;
  source_hook: string;
}

function asRows<T>(rows: unknown[]): T[] {
  return rows as T[];
}

export interface MemoryStore {
  insertMemory(input: MemoryInsertInput): boolean;
  searchCandidates(projectId: string, query: string, limit: number): StoredMemory[];
  getMemoriesByIds(projectId: string, ids: string[]): StoredMemory[];
  getRecentProjectMemories(projectId: string, limit: number): StoredMemory[];
  getLastMemories(projectId: string, limit: number): StoredMemory[];
  pruneMemories(projectId: string, maxAgeDays: number, importanceFloor: number): number;
  stats(projectId: string): MemoryStats;
  close(): void;
}

function rowToStoredMemory(row: MemoryRow): StoredMemory {
  return {
    id: row.id,
    ts: row.ts,
    project_id: row.project_id,
    session_id: row.session_id,
    title: row.title,
    type: row.type as StoredMemory["type"],
    summary: row.summary,
    key_facts: JSON.parse(row.key_facts_json) as string[],
    tags: JSON.parse(row.tags_json) as string[],
    files: JSON.parse(row.files_json) as string[],
    importance: row.importance,
    dedupe_hash: row.dedupe_hash,
    source_hook: row.source_hook
  };
}

export class SqliteMemoryStore implements MemoryStore {
  private readonly dbPath: string;
  private readonly db: Database.Database;

  // Prepared statements — compiled once, reused on every call
  private readonly stmtInsertMemory: Database.Statement;
  private readonly stmtInsertFts: Database.Statement;
  private readonly stmtSearchFts: Database.Statement;
  private readonly stmtRecentMemories: Database.Statement;
  private readonly stmtLastMemories: Database.Statement;
  private readonly stmtPruneSelect: Database.Statement;
  private readonly stmtStatsCount: Database.Statement;
  private readonly stmtStatsLast: Database.Statement;
  private readonly stmtStatsTags: Database.Statement;

  // Atomic insert: memories row + FTS row in one transaction
  private readonly txInsert: (input: MemoryInsertInput) => boolean;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
    mkdirSync(dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);

    // Schema
    this.db.pragma("journal_mode = WAL");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY,
        ts TEXT NOT NULL,
        project_id TEXT NOT NULL,
        session_id TEXT NOT NULL,
        title TEXT NOT NULL,
        type TEXT NOT NULL,
        summary TEXT NOT NULL,
        key_facts_json TEXT NOT NULL,
        tags_json TEXT NOT NULL,
        files_json TEXT NOT NULL,
        importance INTEGER NOT NULL,
        dedupe_hash TEXT NOT NULL UNIQUE,
        source_hook TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_memories_project_ts ON memories(project_id, ts DESC);
      CREATE INDEX IF NOT EXISTS idx_memories_project_importance ON memories(project_id, importance DESC);

      CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
        id UNINDEXED,
        title,
        summary,
        key_facts,
        tags,
        files
      );
    `);

    // Migrate existing FTS tables that predate the key_facts column
    this.migrateFtsIfNeeded();

    // Prepare all statements once at construction time
    this.stmtInsertMemory = this.db.prepare(
      `INSERT OR IGNORE INTO memories (
        id, ts, project_id, session_id, title, type, summary,
        key_facts_json, tags_json, files_json, importance, dedupe_hash, source_hook
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    this.stmtInsertFts = this.db.prepare(
      `INSERT INTO memories_fts (id, title, summary, key_facts, tags, files) VALUES (?, ?, ?, ?, ?, ?)`
    );

    this.stmtSearchFts = this.db.prepare(
      `SELECT m.*
       FROM memories_fts f
       JOIN memories m ON m.id = f.id
       WHERE f.memories_fts MATCH ? AND m.project_id = ?
       ORDER BY bm25(memories_fts), m.importance DESC, m.ts DESC
       LIMIT ?`
    );

    this.stmtRecentMemories = this.db.prepare(
      `SELECT * FROM memories WHERE project_id = ? ORDER BY importance DESC, ts DESC LIMIT ?`
    );

    this.stmtLastMemories = this.db.prepare(
      `SELECT * FROM memories WHERE project_id = ? ORDER BY ts DESC LIMIT ?`
    );

    this.stmtPruneSelect = this.db.prepare(
      `SELECT id FROM memories WHERE project_id = ? AND ts < ? AND importance <= ?`
    );

    this.stmtStatsCount = this.db.prepare(
      `SELECT COUNT(*) AS count FROM memories WHERE project_id = ?`
    );

    this.stmtStatsLast = this.db.prepare(
      `SELECT ts FROM memories WHERE project_id = ? ORDER BY ts DESC LIMIT 1`
    );

    this.stmtStatsTags = this.db.prepare(
      `SELECT tags_json FROM memories WHERE project_id = ? ORDER BY ts DESC LIMIT 300`
    );

    // Atomic insert: memories row + FTS row together
    this.txInsert = this.db.transaction((input: MemoryInsertInput): boolean => {
      const info = this.stmtInsertMemory.run(
        input.id,
        input.ts,
        input.project_id,
        input.session_id,
        input.card.title,
        input.card.type,
        input.card.summary,
        JSON.stringify(input.card.key_facts),
        JSON.stringify(input.card.tags),
        JSON.stringify(input.card.files),
        input.card.importance,
        input.dedupe_hash,
        input.source_hook
      );

      if (info.changes === 0) {
        return false;
      }

      this.stmtInsertFts.run(
        input.id,
        input.card.title,
        input.card.summary,
        input.card.key_facts.join(" "),
        input.card.tags.join(" "),
        input.card.files.join(" ")
      );

      return true;
    });
  }

  insertMemory(input: MemoryInsertInput): boolean {
    return this.txInsert(input);
  }

  searchCandidates(projectId: string, query: string, limit: number): StoredMemory[] {
    const terms = parseSearchTerms(query);

    if (terms.length === 0) {
      return this.getRecentProjectMemories(projectId, limit);
    }

    const ftsQuery = toFtsQuery(terms);
    const rows = this.stmtSearchFts.all(ftsQuery, projectId, limit);
    return asRows<MemoryRow>(rows).map(rowToStoredMemory);
  }

  getMemoriesByIds(projectId: string, ids: string[]): StoredMemory[] {
    if (ids.length === 0) {
      return [];
    }

    // Dynamic IN clause — cannot be pre-prepared (variable arity)
    const placeholders = ids.map(() => "?").join(", ");
    const rows = this.db
      .prepare(`SELECT * FROM memories WHERE project_id = ? AND id IN (${placeholders})`)
      .all(projectId, ...ids);

    const parsedRows = asRows<MemoryRow>(rows);
    const map = new Map(parsedRows.map((row) => [row.id, rowToStoredMemory(row)]));
    return ids.map((id) => map.get(id)).filter((value): value is StoredMemory => value !== undefined);
  }

  getRecentProjectMemories(projectId: string, limit: number): StoredMemory[] {
    const rows = this.stmtRecentMemories.all(projectId, limit);
    return asRows<MemoryRow>(rows).map(rowToStoredMemory);
  }

  getLastMemories(projectId: string, limit: number): StoredMemory[] {
    const rows = this.stmtLastMemories.all(projectId, limit);
    return asRows<MemoryRow>(rows).map(rowToStoredMemory);
  }

  pruneMemories(projectId: string, maxAgeDays: number, importanceFloor: number): number {
    const threshold = new Date(Date.now() - maxAgeDays * 24 * 60 * 60 * 1000).toISOString();

    const ids = this.stmtPruneSelect.all(
      projectId,
      threshold,
      importanceFloor
    ) as Array<{ id: string }>;

    if (ids.length === 0) {
      return 0;
    }

    // Batch delete: two statements instead of 2×N — dynamic IN clause (variable arity)
    const placeholders = ids.map(() => "?").join(", ");
    const idValues = ids.map((item) => item.id);

    this.db.transaction(() => {
      this.db.prepare(`DELETE FROM memories WHERE id IN (${placeholders})`).run(...idValues);
      this.db.prepare(`DELETE FROM memories_fts WHERE id IN (${placeholders})`).run(...idValues);
    })();

    return ids.length;
  }

  stats(projectId: string): MemoryStats {
    const countRow = this.stmtStatsCount.get(projectId) as { count: number };

    const lastRow = this.stmtStatsLast.get(projectId) as { ts?: string } | undefined;

    const tagRows = this.stmtStatsTags.all(projectId) as Array<{ tags_json: string }>;

    const tagCounts = new Map<string, number>();
    for (const row of tagRows) {
      const tags = JSON.parse(row.tags_json) as string[];
      for (const tag of tags) {
        tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
      }
    }

    const topTags = Array.from(tagCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag, count]) => ({ tag, count }));

    return {
      dbPath: this.dbPath,
      totalMemories: countRow.count,
      lastWriteTs: lastRow?.ts ?? null,
      topTags
    };
  }

  close(): void {
    this.db.close();
  }

  /**
   * Rebuilds the FTS table when it predates the key_facts column.
   * FTS5 does not support ALTER TABLE ADD COLUMN, so the table must be
   * dropped and repopulated from the memories source-of-truth.
   */
  private migrateFtsIfNeeded(): void {
    const row = this.db
      .prepare(`SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'memories_fts'`)
      .get() as { sql: string } | undefined;

    if (!row || row.sql.includes("key_facts")) {
      return;
    }

    // Drop old FTS table and recreate with key_facts column
    this.db.exec(`
      DROP TABLE memories_fts;

      CREATE VIRTUAL TABLE memories_fts USING fts5(
        id UNINDEXED,
        title,
        summary,
        key_facts,
        tags,
        files
      );
    `);

    // Repopulate from the memories table
    const rows = this.db
      .prepare(`SELECT id, title, summary, key_facts_json, tags_json, files_json FROM memories`)
      .all() as Array<{
        id: string;
        title: string;
        summary: string;
        key_facts_json: string;
        tags_json: string;
        files_json: string;
      }>;

    if (rows.length === 0) {
      return;
    }

    const insertFts = this.db.prepare(
      `INSERT INTO memories_fts (id, title, summary, key_facts, tags, files) VALUES (?, ?, ?, ?, ?, ?)`
    );

    this.db.transaction(() => {
      for (const r of rows) {
        insertFts.run(
          r.id,
          r.title,
          r.summary,
          (JSON.parse(r.key_facts_json) as string[]).join(" "),
          (JSON.parse(r.tags_json) as string[]).join(" "),
          (JSON.parse(r.files_json) as string[]).join(" ")
        );
      }
    })();
  }
}
