"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMemoryEnvConfig = getMemoryEnvConfig;
const node_os_1 = require("node:os");
const node_path_1 = require("node:path");
function parseIntWithDefault(value, fallback) {
    if (!value) {
        return fallback;
    }
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : fallback;
}
function parseBooleanWithDefault(value, fallback) {
    if (value === undefined) {
        return fallback;
    }
    if (value === "true" || value === "1") {
        return true;
    }
    if (value === "false" || value === "0") {
        return false;
    }
    return fallback;
}
function parseProjectMode(value) {
    return value === "manual" ? "manual" : "cwd-hash";
}
function parseLogLevel(value) {
    if (value === "debug" || value === "info" || value === "warn" || value === "error") {
        return value;
    }
    return "info";
}
function parseJsonStringArray(value) {
    if (!value) {
        return [];
    }
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) {
        throw new Error("MEM_GEMINI_ARGS_JSON must be a JSON array of strings.");
    }
    const values = parsed.filter((item) => typeof item === "string");
    if (values.length !== parsed.length) {
        throw new Error("MEM_GEMINI_ARGS_JSON must contain only string values.");
    }
    return values;
}
function getMemoryEnvConfig() {
    return {
        dbPath: process.env.MEM_DB_PATH ?? (0, node_path_1.join)((0, node_os_1.homedir)(), ".gemini", "gemini-mem"),
        maxInject: parseIntWithDefault(process.env.MEM_MAX_INJECT, 5),
        rerankCandidates: parseIntWithDefault(process.env.MEM_RERANK_CANDIDATES, 20),
        enableSessionStart: parseBooleanWithDefault(process.env.MEM_ENABLE_SESSIONSTART, true),
        enableAfterTool: parseBooleanWithDefault(process.env.MEM_ENABLE_AFTERTOOL, false),
        logLevel: parseLogLevel(process.env.MEM_LOG_LEVEL),
        projectMode: parseProjectMode(process.env.MEM_PROJECT_MODE),
        projectId: process.env.MEM_PROJECT_ID ?? "",
        model: process.env.MEM_MODEL ?? "",
        summarizationTimeoutMs: parseIntWithDefault(process.env.MEM_SUMMARIZATION_TIMEOUT_MS, 60000),
        rerankTimeoutMs: parseIntWithDefault(process.env.MEM_RERANK_TIMEOUT_MS, 45000),
        summaryInputChars: parseIntWithDefault(process.env.MEM_SUMMARY_INPUT_CHARS, 4500),
        maxInjectChars: parseIntWithDefault(process.env.MEM_MAX_INJECT_CHARS, 5200),
        geminiCommand: process.env.MEM_GEMINI_COMMAND ?? "gemini",
        geminiArgs: parseJsonStringArray(process.env.MEM_GEMINI_ARGS_JSON)
    };
}
