import { MemoryMcpService } from "./service";
import { createMemoryTools } from "./tools";
import {
  MCP_DEFAULT_PROTOCOL_VERSION,
  MCP_JSONRPC_VERSION,
  MCP_SERVER_NAME,
  MCP_SERVER_VERSION,
  MCP_SUPPORTED_PROTOCOL_VERSIONS
} from "./constants";
import type {
  JsonRpcNotification,
  JsonRpcRequest,
  JsonRpcResponse,
  McpTool,
  McpToolResultPayload
} from "./types";

const SUPPORTED_PROTOCOL_VERSIONS = new Set<string>(MCP_SUPPORTED_PROTOCOL_VERSIONS);

const JSONRPC_ERRORS = {
  InvalidRequest: -32600,
  MethodNotFound: -32601,
  InvalidParams: -32602,
  InternalError: -32603
} as const;

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function asRequest(value: unknown): JsonRpcRequest | null {
  const input = asObject(value);
  if (!input) {
    return null;
  }
  if (input.jsonrpc !== MCP_JSONRPC_VERSION || typeof input.method !== "string") {
    return null;
  }
  if (typeof input.id !== "string" && typeof input.id !== "number") {
    return null;
  }

  return {
    jsonrpc: MCP_JSONRPC_VERSION,
    id: input.id,
    method: input.method,
    params: asObject(input.params) ?? {}
  };
}

function asNotification(value: unknown): JsonRpcNotification | null {
  const input = asObject(value);
  if (!input) {
    return null;
  }
  if (input.jsonrpc !== MCP_JSONRPC_VERSION || typeof input.method !== "string") {
    return null;
  }
  if ("id" in input) {
    return null;
  }

  return {
    jsonrpc: MCP_JSONRPC_VERSION,
    method: input.method,
    params: asObject(input.params) ?? {}
  };
}

export class MemoryMcpRpcCore {
  static readonly protocolVersion = MCP_DEFAULT_PROTOCOL_VERSION;

  private readonly toolsByName: Map<string, McpTool>;

  constructor() {
    const tools = createMemoryTools(new MemoryMcpService());
    this.toolsByName = new Map(tools.map((tool) => [tool.definition.name, tool]));
  }

  async handleMessage(input: unknown): Promise<JsonRpcResponse | null> {
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

  private async handleRequest(request: JsonRpcRequest): Promise<JsonRpcResponse> {
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
          return this.error(
            request.id,
            JSONRPC_ERRORS.MethodNotFound,
            `Method not found: ${request.method}`
          );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return this.error(request.id, JSONRPC_ERRORS.InternalError, message);
    }
  }

  private handleInitialize(params: Record<string, unknown>): Record<string, unknown> {
    const requested = typeof params.protocolVersion === "string" ? params.protocolVersion : "";
    const negotiated = SUPPORTED_PROTOCOL_VERSIONS.has(requested)
      ? requested
      : MCP_DEFAULT_PROTOCOL_VERSION;

    return {
      protocolVersion: negotiated,
      capabilities: {
        tools: {
          listChanged: false
        }
      },
      serverInfo: {
        name: MCP_SERVER_NAME,
        version: MCP_SERVER_VERSION
      },
      instructions:
        "Use memory_get_context before major tasks, memory_save_observation after key changes, and memory_end_session at wrap-up."
    };
  }

  private async handleToolCall(request: JsonRpcRequest): Promise<JsonRpcResponse> {
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

      const result: McpToolResultPayload = {
        content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
        structuredContent: payload
      };
      return this.result(request.id, result as unknown as Record<string, unknown>);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const failure: McpToolResultPayload = {
        content: [{ type: "text", text: message }],
        structuredContent: { error: message },
        isError: true
      };
      return this.result(request.id, failure as unknown as Record<string, unknown>);
    }
  }

  private handleNotification(notification: JsonRpcNotification): void {
    if (notification.method === "notifications/initialized") {
      return;
    }
  }

  private result(id: string | number | null, result: Record<string, unknown>): JsonRpcResponse {
    return {
      jsonrpc: MCP_JSONRPC_VERSION,
      id,
      result
    };
  }

  private error(
    id: string | number | null,
    code: number,
    message: string,
    data?: unknown
  ): JsonRpcResponse {
    return {
      jsonrpc: MCP_JSONRPC_VERSION,
      id,
      error: data === undefined ? { code, message } : { code, message, data }
    };
  }
}
