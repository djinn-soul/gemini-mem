"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemoryMcpRpcCore = void 0;
const service_1 = require("./service");
const tools_1 = require("./tools");
const constants_1 = require("./constants");
const SUPPORTED_PROTOCOL_VERSIONS = new Set(constants_1.MCP_SUPPORTED_PROTOCOL_VERSIONS);
const JSONRPC_ERRORS = {
    InvalidRequest: -32600,
    MethodNotFound: -32601,
    InvalidParams: -32602,
    InternalError: -32603
};
function asObject(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return null;
    }
    return value;
}
function asRequest(value) {
    const input = asObject(value);
    if (!input) {
        return null;
    }
    if (input.jsonrpc !== constants_1.MCP_JSONRPC_VERSION || typeof input.method !== "string") {
        return null;
    }
    if (typeof input.id !== "string" && typeof input.id !== "number") {
        return null;
    }
    return {
        jsonrpc: constants_1.MCP_JSONRPC_VERSION,
        id: input.id,
        method: input.method,
        params: asObject(input.params) ?? {}
    };
}
function asNotification(value) {
    const input = asObject(value);
    if (!input) {
        return null;
    }
    if (input.jsonrpc !== constants_1.MCP_JSONRPC_VERSION || typeof input.method !== "string") {
        return null;
    }
    if ("id" in input) {
        return null;
    }
    return {
        jsonrpc: constants_1.MCP_JSONRPC_VERSION,
        method: input.method,
        params: asObject(input.params) ?? {}
    };
}
class MemoryMcpRpcCore {
    static protocolVersion = constants_1.MCP_DEFAULT_PROTOCOL_VERSION;
    toolsByName;
    constructor() {
        const tools = (0, tools_1.createMemoryTools)(new service_1.MemoryMcpService());
        this.toolsByName = new Map(tools.map((tool) => [tool.definition.name, tool]));
    }
    async handleMessage(input) {
        const request = asRequest(input);
        if (request) {
            return this.handleRequest(request);
        }
        const notification = asNotification(input);
        if (notification) {
            this.handleNotification(notification);
            return null;
        }
        return this.error(null, JSONRPC_ERRORS.InvalidRequest, "Invalid JSON-RPC message.");
    }
    async handleRequest(request) {
        try {
            switch (request.method) {
                case "initialize":
                    return this.result(request.id, this.handleInitialize(request.params ?? {}));
                case "ping":
                    return this.result(request.id, {});
                case "tools/list":
                    return this.result(request.id, {
                        tools: Array.from(this.toolsByName.values()).map((tool) => tool.definition)
                    });
                case "tools/call":
                    return this.handleToolCall(request);
                default:
                    return this.error(request.id, JSONRPC_ERRORS.MethodNotFound, `Method not found: ${request.method}`);
            }
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            return this.error(request.id, JSONRPC_ERRORS.InternalError, message);
        }
    }
    handleInitialize(params) {
        const requested = typeof params.protocolVersion === "string" ? params.protocolVersion : "";
        const negotiated = SUPPORTED_PROTOCOL_VERSIONS.has(requested)
            ? requested
            : constants_1.MCP_DEFAULT_PROTOCOL_VERSION;
        return {
            protocolVersion: negotiated,
            capabilities: {
                tools: {
                    listChanged: false
                }
            },
            serverInfo: {
                name: constants_1.MCP_SERVER_NAME,
                version: constants_1.MCP_SERVER_VERSION
            },
            instructions: "Use memory_get_context before major tasks, memory_save_observation after key changes, and memory_end_session at wrap-up."
        };
    }
    async handleToolCall(request) {
        const params = request.params ?? {};
        const name = typeof params.name === "string" ? params.name : "";
        const tool = this.toolsByName.get(name);
        if (!tool) {
            return this.error(request.id, JSONRPC_ERRORS.InvalidParams, `Unknown tool: ${name}`);
        }
        const toolArgs = asObject(params.arguments) ?? {};
        try {
            const payload = await tool.run({
                name,
                arguments: toolArgs
            });
            const result = {
                content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
                structuredContent: payload
            };
            return this.result(request.id, result);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            const failure = {
                content: [{ type: "text", text: message }],
                structuredContent: { error: message },
                isError: true
            };
            return this.result(request.id, failure);
        }
    }
    handleNotification(notification) {
        if (notification.method === "notifications/initialized") {
            return;
        }
    }
    result(id, result) {
        return {
            jsonrpc: constants_1.MCP_JSONRPC_VERSION,
            id,
            result
        };
    }
    error(id, code, message, data) {
        return {
            jsonrpc: constants_1.MCP_JSONRPC_VERSION,
            id,
            error: data === undefined ? { code, message } : { code, message, data }
        };
    }
}
exports.MemoryMcpRpcCore = MemoryMcpRpcCore;
