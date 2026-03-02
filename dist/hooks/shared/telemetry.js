"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.writeHookTelemetry = writeHookTelemetry;
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const db_path_1 = require("../../memory/db-path");
const project_id_1 = require("../../memory/project-id");
function writeHookTelemetry(config, input, payload) {
    if (!config.hookTelemetry) {
        return;
    }
    try {
        const cwd = input.cwd ?? process.cwd();
        const projectId = (0, project_id_1.resolveProjectId)({
            cwd,
            mode: config.projectMode,
            manualProjectId: config.projectId
        });
        const dbPath = (0, db_path_1.resolveMemoryDbPath)(config.dbPath, cwd);
        const logPath = (0, node_path_1.join)((0, node_path_1.dirname)(dbPath), "hook.log");
        (0, node_fs_1.mkdirSync)((0, node_path_1.dirname)(logPath), { recursive: true });
        const line = {
            ts: input.timestamp ?? new Date().toISOString(),
            hook: payload.hook,
            event: payload.event,
            projectId,
            sessionId: input.session_id ?? null,
            message: payload.message ?? null
        };
        (0, node_fs_1.appendFileSync)(logPath, `${JSON.stringify(line)}\n`, { encoding: "utf8" });
    }
    catch {
        // Telemetry is best-effort and must never break hook execution.
    }
}
