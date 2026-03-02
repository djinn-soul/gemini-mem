import { MemoryMcpService } from "./service";
import type { McpTool, McpToolCallContext } from "./types";

const PROJECT_SCOPE_PROPERTIES = {
  project_cwd: {
    type: "string",
    description: "Absolute project path. Defaults to server process cwd."
  },
  project_id: {
    type: "string",
    description: "Explicit project id override."
  }
} as const;

function createJsonSchema(
  properties: Record<string, unknown>,
  required: string[] = []
): Record<string, unknown> {
  return {
    type: "object",
    properties,
    required
  };
}

export function createMemoryTools(service: MemoryMcpService): McpTool[] {
  const run = async (
    input: McpToolCallContext,
    handler: (args: Record<string, unknown>) => Record<string, unknown>
  ): Promise<Record<string, unknown>> => handler(input.arguments ?? {});

  return [
    {
      definition: {
        name: "memory_status",
        description: "Get memory database status for the current project scope.",
        inputSchema: createJsonSchema({ ...PROJECT_SCOPE_PROPERTIES })
      },
      run: (input) => run(input, (args) => service.memoryStatus(args))
    },
    {
      definition: {
        name: "memory_search",
        description: "Search stored memories with FTS.",
        inputSchema: createJsonSchema(
          {
            ...PROJECT_SCOPE_PROPERTIES,
            query: { type: "string", description: "Natural language search query." },
            limit: { type: "number", description: "Max results (1-50). Default 10." }
          },
          ["query"]
        )
      },
      run: (input) => run(input, (args) => service.memorySearch(args))
    },
    {
      definition: {
        name: "memory_get_context",
        description: "Build a compact context pack with citations for a task/query.",
        inputSchema: createJsonSchema({
          ...PROJECT_SCOPE_PROPERTIES,
          query: { type: "string", description: "Task/query text to retrieve context for." },
          max_items: { type: "number", description: "Max memories to include (1-20)." },
          max_chars: { type: "number", description: "Max context text size (300-12000)." }
        })
      },
      run: (input) => run(input, (args) => service.memoryGetContext(args))
    },
    {
      definition: {
        name: "memory_save_observation",
        description: "Persist a memory observation with optional tags/files for future retrieval.",
        inputSchema: createJsonSchema(
          {
            ...PROJECT_SCOPE_PROPERTIES,
            title: { type: "string", description: "Memory title." },
            summary: { type: "string", description: "High-signal summary text." },
            type: {
              type: "string",
              description: "task|decision|fact|constraint|risk|other. Default fact."
            },
            key_facts: { type: "array", items: { type: "string" } },
            tags: { type: "array", items: { type: "string" } },
            files: { type: "array", items: { type: "string" } },
            importance: { type: "number", description: "1-5. Default 3." },
            session_id: { type: "string" },
            source_hook: { type: "string" }
          },
          ["title", "summary"]
        )
      },
      run: (input) => run(input, (args) => service.memorySaveObservation(args))
    },
    {
      definition: {
        name: "memory_cite",
        description: "Fetch a full memory record by id for citation drill-down.",
        inputSchema: createJsonSchema(
          {
            ...PROJECT_SCOPE_PROPERTIES,
            id: { type: "string", description: "Memory id UUID." }
          },
          ["id"]
        )
      },
      run: (input) => run(input, (args) => service.memoryCite(args))
    },
    {
      definition: {
        name: "memory_end_session",
        description: "Store a final session summary card in memory.",
        inputSchema: createJsonSchema(
          {
            ...PROJECT_SCOPE_PROPERTIES,
            session_id: { type: "string" },
            title: { type: "string" },
            summary: { type: "string", description: "Session summary text." },
            key_facts: { type: "array", items: { type: "string" } },
            tags: { type: "array", items: { type: "string" } },
            files: { type: "array", items: { type: "string" } }
          },
          ["summary"]
        )
      },
      run: (input) => run(input, (args) => service.memoryEndSession(args))
    }
  ];
}
