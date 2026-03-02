const test = require("node:test");
const assert = require("node:assert/strict");
const { mkdtempSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join, resolve } = require("node:path");
const { spawn } = require("node:child_process");
const { createInterface } = require("node:readline");

const repoRoot = resolve(__dirname, "..");

function startMcpServer(tempDir) {
  const dbRoot = join(tempDir, "db-root");
  const env = {
    ...process.env,
    MEM_DB_PATH: dbRoot,
    MEM_PROJECT_MODE: "manual",
    MEM_PROJECT_ID: "integration-project",
    MEM_LOG_LEVEL: "error"
  };

  const child = spawn(process.execPath, [resolve(repoRoot, "dist", "mcp", "server.js")], {
    cwd: repoRoot,
    env,
    stdio: ["pipe", "pipe", "pipe"]
  });

  const pending = new Map();
  const rl = createInterface({ input: child.stdout, crlfDelay: Infinity });
  rl.on("line", (line) => {
    const text = line.trim();
    if (!text) {
      return;
    }

    const message = JSON.parse(text);
    if (Object.prototype.hasOwnProperty.call(message, "id")) {
      const waiter = pending.get(message.id);
      if (waiter) {
        pending.delete(message.id);
        waiter.resolve(message);
      }
    }
  });

  let nextId = 1;

  function request(method, params = {}, timeoutMs = 5000) {
    const id = nextId++;
    const payload = JSON.stringify({
      jsonrpc: "2.0",
      id,
      method,
      params
    });

    child.stdin.write(`${payload}\n`);

    return new Promise((resolvePromise, rejectPromise) => {
      const timeout = setTimeout(() => {
        pending.delete(id);
        rejectPromise(new Error(`Timed out waiting for response to ${method}`));
      }, timeoutMs);

      pending.set(id, {
        resolve: (message) => {
          clearTimeout(timeout);
          resolvePromise(message);
        }
      });
    });
  }

  async function close() {
    rl.close();
    child.kill();
    await new Promise((resolvePromise) => {
      child.on("exit", () => resolvePromise());
    });
  }

  return { request, close };
}

test("MCP server initializes and exposes memory tools", async () => {
  const tempDir = mkdtempSync(join(tmpdir(), "gemini-mem-mcp-init-"));
  const server = startMcpServer(tempDir);

  try {
    const init = await server.request("initialize", {
      protocolVersion: "2025-03-26",
      capabilities: {},
      clientInfo: { name: "test-client", version: "0.0.1" }
    });
    assert.equal(init.result.protocolVersion, "2025-03-26");

    const tools = await server.request("tools/list", {});
    const names = tools.result.tools.map((tool) => tool.name);
    assert.ok(names.includes("memory_status"));
    assert.ok(names.includes("memory_get_context"));
    assert.ok(names.includes("memory_save_observation"));
  } finally {
    await server.close();
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("MCP tools save/search/cite context using shared memory store", async () => {
  const tempDir = mkdtempSync(join(tmpdir(), "gemini-mem-mcp-flow-"));
  const server = startMcpServer(tempDir);

  try {
    await server.request("initialize", {
      protocolVersion: "2025-03-26",
      capabilities: {},
      clientInfo: { name: "test-client", version: "0.0.1" }
    });

    const save = await server.request("tools/call", {
      name: "memory_save_observation",
      arguments: {
        title: "Bridge architecture note",
        summary: "Go core and Python wrapper communicate through a C bridge.",
        type: "decision",
        key_facts: ["Go engine exposed via C ABI", "Python package loads shared library"],
        tags: ["architecture", "c-bridge"],
        files: ["bindings/c/bridge.go"],
        importance: 4
      }
    });

    const savePayload = save.result.structuredContent;
    assert.equal(savePayload.inserted, true);
    assert.ok(typeof savePayload.id === "string");

    const search = await server.request("tools/call", {
      name: "memory_search",
      arguments: {
        query: "C bridge architecture",
        limit: 5
      }
    });
    const searchPayload = search.result.structuredContent;
    assert.equal(searchPayload.count >= 1, true);

    const cite = await server.request("tools/call", {
      name: "memory_cite",
      arguments: { id: savePayload.id }
    });
    assert.equal(cite.result.structuredContent.memory.title, "Bridge architecture note");

    const context = await server.request("tools/call", {
      name: "memory_get_context",
      arguments: { query: "bridge", max_items: 3 }
    });
    assert.equal(context.result.structuredContent.citations.length >= 1, true);
  } finally {
    await server.close();
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("MCP tool validation errors return tool-level error payloads", async () => {
  const tempDir = mkdtempSync(join(tmpdir(), "gemini-mem-mcp-error-"));
  const server = startMcpServer(tempDir);

  try {
    await server.request("initialize", {
      protocolVersion: "2025-03-26",
      capabilities: {},
      clientInfo: { name: "test-client", version: "0.0.1" }
    });

    const badCall = await server.request("tools/call", {
      name: "memory_search",
      arguments: {}
    });

    assert.equal(badCall.result.isError, true);
    assert.ok(String(badCall.result.content[0].text).includes("query is required"));
  } finally {
    await server.close();
    rmSync(tempDir, { recursive: true, force: true });
  }
});
