"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_http_1 = require("node:http");
const constants_1 = require("./constants");
const rpc_core_1 = require("./rpc-core");
const DEFAULT_HOST = process.env.MEM_MCP_HTTP_HOST ?? constants_1.MCP_HTTP_DEFAULT_HOST;
const DEFAULT_PORT = Number.parseInt(process.env.MEM_MCP_HTTP_PORT ?? `${constants_1.MCP_HTTP_DEFAULT_PORT}`, 10);
const DEFAULT_PATH = process.env.MEM_MCP_HTTP_PATH ?? constants_1.MCP_HTTP_DEFAULT_PATH;
function readBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        let total = 0;
        req.on("data", (chunk) => {
            total += chunk.length;
            if (total > constants_1.MCP_HTTP_MAX_BODY_BYTES) {
                reject(new Error("Request body too large."));
                req.destroy();
                return;
            }
            chunks.push(chunk);
        });
        req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
        req.on("error", reject);
    });
}
function sendJson(res, statusCode, body) {
    const payload = JSON.stringify(body);
    res.statusCode = statusCode;
    res.setHeader("Content-Type", "application/json");
    res.setHeader("MCP-Protocol-Version", rpc_core_1.MemoryMcpRpcCore.protocolVersion);
    res.end(payload);
}
function sendText(res, statusCode, text) {
    res.statusCode = statusCode;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("MCP-Protocol-Version", rpc_core_1.MemoryMcpRpcCore.protocolVersion);
    res.end(text);
}
function start() {
    const core = new rpc_core_1.MemoryMcpRpcCore();
    const server = (0, node_http_1.createServer)(async (req, res) => {
        const url = req.url ?? "/";
        if (url !== DEFAULT_PATH) {
            sendText(res, 404, "Not found.");
            return;
        }
        if (req.method !== "POST") {
            sendText(res, 405, "Use POST for MCP JSON-RPC requests.");
            return;
        }
        try {
            const raw = await readBody(req);
            if (!raw.trim()) {
                sendJson(res, 400, {
                    jsonrpc: constants_1.MCP_JSONRPC_VERSION,
                    id: null,
                    error: {
                        code: -32700,
                        message: "Invalid JSON."
                    }
                });
                return;
            }
            const parsed = JSON.parse(raw);
            const response = await core.handleMessage(parsed);
            if (!response) {
                res.statusCode = 202;
                res.setHeader("MCP-Protocol-Version", rpc_core_1.MemoryMcpRpcCore.protocolVersion);
                res.end();
                return;
            }
            sendJson(res, 200, response);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : "Internal error.";
            sendJson(res, 500, {
                jsonrpc: constants_1.MCP_JSONRPC_VERSION,
                id: null,
                error: {
                    code: -32603,
                    message
                }
            });
        }
    });
    server.listen(DEFAULT_PORT, DEFAULT_HOST, () => {
        process.stderr.write(`[gemini-mem] MCP HTTP server listening on http://${DEFAULT_HOST}:${DEFAULT_PORT}${DEFAULT_PATH}\n`);
    });
}
start();
