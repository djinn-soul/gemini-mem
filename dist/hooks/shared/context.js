"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createHookRuntimeContext = createHookRuntimeContext;
const project_id_1 = require("../../memory/project-id");
const db_path_1 = require("../../memory/db-path");
const store_1 = require("../../memory/store");
const logger_1 = require("./logger");
function createHookRuntimeContext(config, input) {
    const logger = new logger_1.Logger(config.logLevel);
    const cwd = input.cwd ?? process.cwd();
    const projectId = (0, project_id_1.resolveProjectId)({
        cwd,
        mode: config.projectMode,
        manualProjectId: config.projectId
    });
    const store = new store_1.SqliteMemoryStore((0, db_path_1.resolveMemoryDbPath)(config.dbPath, cwd));
    return {
        config,
        logger,
        store,
        projectId
    };
}
