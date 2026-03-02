"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const env_1 = require("../hooks/shared/env");
const db_path_1 = require("../memory/db-path");
const project_id_1 = require("../memory/project-id");
const store_1 = require("../memory/store");
function main() {
    const maxAgeDaysArg = process.argv[2];
    const importanceArg = process.argv[3];
    const maxAgeDays = maxAgeDaysArg ? Number.parseInt(maxAgeDaysArg, 10) : 30;
    const importanceFloor = importanceArg ? Number.parseInt(importanceArg, 10) : 2;
    if (!Number.isFinite(maxAgeDays) || maxAgeDays <= 0) {
        throw new Error("Usage: mem-prune [maxAgeDays>0] [importanceFloor>=1]");
    }
    if (!Number.isFinite(importanceFloor) || importanceFloor < 1) {
        throw new Error("Usage: mem-prune [maxAgeDays>0] [importanceFloor>=1]");
    }
    const config = (0, env_1.getMemoryEnvConfig)();
    const cwd = process.cwd();
    const projectId = (0, project_id_1.resolveProjectId)({
        cwd,
        mode: config.projectMode,
        manualProjectId: config.projectId
    });
    const store = new store_1.SqliteMemoryStore((0, db_path_1.resolveMemoryDbPath)(config.dbPath, cwd));
    try {
        const deleted = store.pruneMemories(projectId, maxAgeDays, importanceFloor);
        process.stdout.write(`${JSON.stringify({ deleted, maxAgeDays, importanceFloor }, null, 2)}\n`);
    }
    finally {
        store.close();
    }
}
main();
