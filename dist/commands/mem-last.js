"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const env_1 = require("../hooks/shared/env");
const db_path_1 = require("../memory/db-path");
const project_id_1 = require("../memory/project-id");
const store_1 = require("../memory/store");
function parseArgs() {
    const args = process.argv.slice(2);
    let limit = 5;
    let jsonOutput = false;
    let limitSeen = false;
    for (const arg of args) {
        if (arg === "--json") {
            jsonOutput = true;
            continue;
        }
        if (limitSeen) {
            throw new Error("Usage: mem-last [limit>0] [--json]");
        }
        const parsed = Number.parseInt(arg, 10);
        if (!Number.isFinite(parsed) || parsed <= 0) {
            throw new Error("Usage: mem-last [limit>0] [--json]");
        }
        limit = parsed;
        limitSeen = true;
    }
    return { limit, jsonOutput };
}
function formatMemoriesText(items) {
    if (items.length === 0) {
        return "No memories found for this project.\n";
    }
    const lines = [`Latest memories (${items.length}):`];
    for (const [index, item] of items.entries()) {
        const tags = item.tags.length > 0 ? item.tags.join(", ") : "none";
        lines.push("", `${index + 1}. ${item.title}`, `   type: ${item.type} | importance: ${item.importance} | ts: ${item.ts}`, `   tags: ${tags}`, `   summary: ${item.summary}`);
    }
    return `${lines.join("\n")}\n`;
}
function main() {
    const { limit, jsonOutput } = parseArgs();
    const config = (0, env_1.getMemoryEnvConfig)();
    const cwd = process.cwd();
    const projectId = (0, project_id_1.resolveProjectId)({
        cwd,
        mode: config.projectMode,
        manualProjectId: config.projectId
    });
    const store = new store_1.SqliteMemoryStore((0, db_path_1.resolveMemoryDbPath)(config.dbPath, cwd));
    try {
        const items = store.getLastMemories(projectId, limit);
        if (jsonOutput) {
            process.stdout.write(`${JSON.stringify(items, null, 2)}\n`);
            return;
        }
        process.stdout.write(formatMemoriesText(items));
    }
    finally {
        store.close();
    }
}
main();
