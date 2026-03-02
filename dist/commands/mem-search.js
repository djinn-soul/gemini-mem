"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const env_1 = require("../hooks/shared/env");
const db_path_1 = require("../memory/db-path");
const project_id_1 = require("../memory/project-id");
const store_1 = require("../memory/store");
function main() {
    const query = process.argv.slice(2).join(" ").trim();
    if (!query) {
        throw new Error("Usage: mem-search <query>");
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
        const matches = store.searchCandidates(projectId, query, config.rerankCandidates);
        process.stdout.write(`${JSON.stringify(matches, null, 2)}\n`);
    }
    finally {
        store.close();
    }
}
main();
