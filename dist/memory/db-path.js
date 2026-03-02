"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveMemoryDbPath = resolveMemoryDbPath;
const node_path_1 = require("node:path");
const node_os_1 = require("node:os");
const SQLITE_FILE_SUFFIXES = [".db", ".sqlite", ".sqlite3"];
function expandHome(pathValue) {
    if (pathValue === "~") {
        return (0, node_os_1.homedir)();
    }
    if (pathValue.startsWith("~/") || pathValue.startsWith("~\\")) {
        return (0, node_path_1.join)((0, node_os_1.homedir)(), pathValue.slice(2));
    }
    return pathValue;
}
function looksLikeSqliteFile(pathValue) {
    const lower = pathValue.toLowerCase();
    return SQLITE_FILE_SUFFIXES.some((suffix) => lower.endsWith(suffix));
}
function sanitizeProjectFolderName(cwd) {
    const folder = (0, node_path_1.basename)(cwd.trim()) || "project";
    const sanitized = folder.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-");
    return sanitized || "project";
}
function resolveMemoryDbPath(dbPathSetting, projectCwd) {
    const trimmedSetting = dbPathSetting.trim();
    if (!trimmedSetting) {
        throw new Error("MEM_DB_PATH must not be empty.");
    }
    const expanded = expandHome(trimmedSetting);
    const absolute = (0, node_path_1.isAbsolute)(expanded) ? expanded : (0, node_path_1.resolve)(projectCwd, expanded);
    if (looksLikeSqliteFile(absolute)) {
        return absolute;
    }
    const projectFolder = sanitizeProjectFolderName(projectCwd);
    return (0, node_path_1.join)(absolute, projectFolder, "memory.db");
}
