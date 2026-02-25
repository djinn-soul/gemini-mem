export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcNotification {
  jsonrpc: "2.0";
  method: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: Record<string, unknown>;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export interface McpToolResultPayload {
  content: Array<{
    type: "text";
    text: string;
  }>;
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
}

export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface McpToolCallContext {
  name: string;
  arguments: Record<string, unknown>;
}

export interface McpTool {
  definition: McpToolDefinition;
  run(input: McpToolCallContext): Promise<Record<string, unknown>>;
}
