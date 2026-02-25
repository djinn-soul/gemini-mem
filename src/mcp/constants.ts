import { readFileSync } from "node:fs";
import { join } from "node:path";

function readPackageVersion(): string {
  const packageJsonPath = join(__dirname, "..", "..", "package.json");
  const raw = readFileSync(packageJsonPath, "utf8");
  const parsed = JSON.parse(raw) as { version?: unknown };

  if (typeof parsed.version !== "string" || parsed.version.trim().length === 0) {
    throw new Error("Invalid package.json: missing string version.");
  }

  return parsed.version.trim();
}

export const MCP_JSONRPC_VERSION = "2.0";
export const MCP_SERVER_NAME = "gemini-mem-mcp";
export const MCP_SERVER_VERSION = readPackageVersion();

export const MCP_DEFAULT_PROTOCOL_VERSION = "2025-03-26";
export const MCP_SUPPORTED_PROTOCOL_VERSIONS = ["2025-03-26", "2024-11-05", "2024-10-07"] as const;

export const MCP_HTTP_DEFAULT_HOST = "127.0.0.1";
export const MCP_HTTP_DEFAULT_PORT = 3303;
export const MCP_HTTP_DEFAULT_PATH = "/mcp";
export const MCP_HTTP_MAX_BODY_BYTES = 1024 * 1024;
