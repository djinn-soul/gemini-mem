"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_readline_1 = require("node:readline");
const constants_1 = require("./constants");
const rpc_core_1 = require("./rpc-core");
const JSONRPC_PARSE_ERROR = {
    jsonrpc: constants_1.MCP_JSONRPC_VERSION,
    id: null,
    error: {
        code: -32700,
        message: "Invalid JSON."
    }
};
function writeMessage(message) {
    process.stdout.write(`${JSON.stringify(message)}\n`);
}
function start() {
    const core = new rpc_core_1.MemoryMcpRpcCore();
    const reader = (0, node_readline_1.createInterface)({
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
        }
        catch {
            writeMessage(JSONRPC_PARSE_ERROR);
        }
    });
}
start();
