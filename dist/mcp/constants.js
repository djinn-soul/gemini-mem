"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MCP_HTTP_MAX_BODY_BYTES = exports.MCP_HTTP_DEFAULT_PATH = exports.MCP_HTTP_DEFAULT_PORT = exports.MCP_HTTP_DEFAULT_HOST = exports.MCP_SUPPORTED_PROTOCOL_VERSIONS = exports.MCP_DEFAULT_PROTOCOL_VERSION = exports.MCP_SERVER_VERSION = exports.MCP_SERVER_NAME = exports.MCP_JSONRPC_VERSION = void 0;
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
function readPackageVersion() {
    const packageJsonPath = (0, node_path_1.join)(__dirname, "..", "..", "package.json");
    const raw = (0, node_fs_1.readFileSync)(packageJsonPath, "utf8");
    const parsed = JSON.parse(raw);
    if (typeof parsed.version !== "string" || parsed.version.trim().length === 0) {
        throw new Error("Invalid package.json: missing string version.");
    }
    return parsed.version.trim();
}
exports.MCP_JSONRPC_VERSION = "2.0";
exports.MCP_SERVER_NAME = "gemini-mem-mcp";
exports.MCP_SERVER_VERSION = readPackageVersion();
exports.MCP_DEFAULT_PROTOCOL_VERSION = "2025-03-26";
exports.MCP_SUPPORTED_PROTOCOL_VERSIONS = ["2025-03-26", "2024-11-05", "2024-10-07"];
exports.MCP_HTTP_DEFAULT_HOST = "127.0.0.1";
exports.MCP_HTTP_DEFAULT_PORT = 3303;
exports.MCP_HTTP_DEFAULT_PATH = "/mcp";
exports.MCP_HTTP_MAX_BODY_BYTES = 1024 * 1024;
