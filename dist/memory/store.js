"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SqliteMemoryStore = void 0;
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const node_sqlite_1 = require("node:sqlite");
const retrieve_1 = require("./retrieve");
function asRows(rows) {
    return rows;
}
function rowToStoredMemory(row) {
    return {
        id: row.id,
        ts: row.ts,
        project_id: row.project_id,
        session_id: row.session_id,
        title: row.title,
        type: row.type,
        summary: row.summary,
        key_facts: JSON.parse(row.key_facts_json),
        tags: JSON.parse(row.tags_json),
        files: JSON.parse(row.files_json),
        importance: row.importance,
        dedupe_hash: row.dedupe_hash,
        source_hook: row.source_hook
    };
}
class SqliteMemoryStore {
    dbPath;
    db;
    constructor(dbPath) {
        this.dbPath = dbPath;
        (0, node_fs_1.mkdirSync)((0, node_path_1.dirname)(dbPath), { recursive: true });
        this.db = new node_sqlite_1.DatabaseSync(dbPath);
        this.initialize();
    }
    insertMemory(input) {
        const insertMemoryStmt = this.db.prepare(`INSERT OR IGNORE INTO memories (
        id, ts, project_id, session_id, title, type, summary,
        key_facts_json, tags_json, files_json, importance, dedupe_hash, source_hook
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
        const info = insertMemoryStmt.run(input.id, input.ts, input.project_id, input.session_id, input.card.title, input.card.type, input.card.summary, JSON.stringify(input.card.key_facts), JSON.stringify(input.card.tags), JSON.stringify(input.card.files), input.card.importance, input.dedupe_hash, input.source_hook);
        if (info.changes === 0) {
            return false;
        }
        this.db
            .prepare(`INSERT INTO memories_fts (id, title, summary, tags, files)
         VALUES (?, ?, ?, ?, ?)`)
            .run(input.id, input.card.title, input.card.summary, input.card.tags.join(" "), input.card.files.join(" "));
        return true;
    }
    searchCandidates(projectId, query, limit) {
        const terms = (0, retrieve_1.parseSearchTerms)(query);
        if (terms.length === 0) {
            return this.getRecentProjectMemories(projectId, limit);
        }
        const ftsQuery = (0, retrieve_1.toFtsQuery)(terms);
        const rows = this.db
            .prepare(`SELECT m.*
         FROM memories_fts f
         JOIN memories m ON m.id = f.id
         WHERE f.memories_fts MATCH ? AND m.project_id = ?
         ORDER BY bm25(memories_fts), m.importance DESC, m.ts DESC
         LIMIT ?`)
            .all(ftsQuery, projectId, limit);
        return asRows(rows).map(rowToStoredMemory);
    }
    getMemoriesByIds(projectId, ids) {
        if (ids.length === 0) {
            return [];
        }
        const placeholders = ids.map(() => "?").join(", ");
        const rows = this.db
            .prepare(`SELECT * FROM memories WHERE project_id = ? AND id IN (${placeholders})`)
            .all(projectId, ...ids);
        const parsedRows = asRows(rows);
        const map = new Map(parsedRows.map((row) => [row.id, rowToStoredMemory(row)]));
        return ids.map((id) => map.get(id)).filter((value) => value !== undefined);
    }
    getRecentProjectMemories(projectId, limit) {
        const rows = this.db
            .prepare(`SELECT * FROM memories WHERE project_id = ? ORDER BY importance DESC, ts DESC LIMIT ?`)
            .all(projectId, limit);
        return asRows(rows).map(rowToStoredMemory);
    }
    getLastMemories(projectId, limit) {
        const rows = this.db
            .prepare(`SELECT * FROM memories WHERE project_id = ? ORDER BY ts DESC LIMIT ?`)
            .all(projectId, limit);
        return asRows(rows).map(rowToStoredMemory);
    }
    pruneMemories(projectId, maxAgeDays, importanceFloor) {
        const threshold = new Date(Date.now() - maxAgeDays * 24 * 60 * 60 * 1000).toISOString();
        const ids = this.db
            .prepare(`SELECT id FROM memories
         WHERE project_id = ? AND ts < ? AND importance <= ?`)
            .all(projectId, threshold, importanceFloor);
        if (ids.length === 0) {
            return 0;
        }
        const deleteMemoryStmt = this.db.prepare(`DELETE FROM memories WHERE id = ?`);
        const deleteFtsStmt = this.db.prepare(`DELETE FROM memories_fts WHERE id = ?`);
        this.db.exec("BEGIN");
        try {
            for (const item of ids) {
                deleteMemoryStmt.run(item.id);
                deleteFtsStmt.run(item.id);
            }
            this.db.exec("COMMIT");
        }
        catch (error) {
            this.db.exec("ROLLBACK");
            throw error;
        }
        return ids.length;
    }
    stats(projectId) {
        const countRow = this.db
            .prepare(`SELECT COUNT(*) AS count FROM memories WHERE project_id = ?`)
            .get(projectId);
        const lastRow = this.db
            .prepare(`SELECT ts FROM memories WHERE project_id = ? ORDER BY ts DESC LIMIT 1`)
            .get(projectId);
        const tagRows = this.db
            .prepare(`SELECT tags_json FROM memories WHERE project_id = ? ORDER BY ts DESC LIMIT 300`)
            .all(projectId);
        const tagCounts = new Map();
        for (const row of tagRows) {
            const tags = JSON.parse(row.tags_json);
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
    close() {
        this.db.close();
    }
    initialize() {
        this.db.exec(`
      PRAGMA journal_mode = WAL;

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
        tags,
        files
      );
    `);
    }
}
exports.SqliteMemoryStore = SqliteMemoryStore;
