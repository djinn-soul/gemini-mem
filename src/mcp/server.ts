import { createInterface } from "node:readline";
import { MCP_JSONRPC_VERSION } from "./constants";
import { MemoryMcpRpcCore } from "./rpc-core";

const JSONRPC_PARSE_ERROR = {
  jsonrpc: MCP_JSONRPC_VERSION,
  id: null,
  error: {
    code: -32700,
    message: "Invalid JSON."
  }
} as const;

function writeMessage(message: unknown): void {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

function start(): void {
  const core = new MemoryMcpRpcCore();
  const reader = createInterface({
    input: process.stdin,
    crlfDelay: Infinity
  });

  reader.on("line", async (line) => {
    const raw = line.trim();
    if (!raw) {
      return;
    }

    try {
      const parsed = JSON.parse(raw);
      const response = await core.handleMessage(parsed);
      if (response) {
        writeMessage(response);
      }
    } catch {
      writeMessage(JSONRPC_PARSE_ERROR);
    }
  });
}

start();
