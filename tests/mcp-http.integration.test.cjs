const test = require("node:test");
const assert = require("node:assert/strict");
const { mkdtempSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join, resolve } = require("node:path");
const { spawn } = require("node:child_process");
const net = require("node:net");

const repoRoot = resolve(__dirname, "..");

function getFreePort() {
  return new Promise((resolvePromise, rejectPromise) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        rejectPromise(new Error("Failed to acquire free port."));
        return;
      }
      const port = address.port;
      server.close(() => resolvePromise(port));
    });
    server.on("error", rejectPromise);
  });
}

async function startHttpServer(tempDir) {
  const port = await getFreePort();
  const env = {
    ...process.env,
    MEM_DB_PATH: join(tempDir, "db-root"),
    MEM_PROJECT_MODE: "manual",
    MEM_PROJECT_ID: "integration-project",
    MEM_MCP_HTTP_HOST: "127.0.0.1",
    MEM_MCP_HTTP_PORT: String(port),
    MEM_MCP_HTTP_PATH: "/mcp"
  };

  const child = spawn(process.execPath, [resolve(repoRoot, "dist", "mcp", "http-server.js")], {
    cwd: repoRoot,
    env,
    stdio: ["ignore", "pipe", "pipe"]
  });

  await new Promise((resolvePromise, rejectPromise) => {
    const timeout = setTimeout(() => {
      rejectPromise(new Error("MCP HTTP server did not start in time."));
    }, 5000);

    child.stderr.on("data", (chunk) => {
      const message = String(chunk);
      if (message.includes("MCP HTTP server listening")) {
        clearTimeout(timeout);
        resolvePromise();
      }
    });

    child.on("exit", (code) => {
      clearTimeout(timeout);
      rejectPromise(new Error(`HTTP server exited early (${code})`));
    });
  });

  async function call(payload) {
    const response = await fetch(`http://127.0.0.1:${port}/mcp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const text = await response.text();
    return {
      status: response.status,
      body: text ? JSON.parse(text) : null
    };
  }

  async function close() {
    child.kill();
    await new Promise((resolvePromise) => {
      child.on("exit", () => resolvePromise());
    });
  }

  return { call, close };
}

test("MCP HTTP initialize and tools/list", async () => {
  const tempDir = mkdtempSync(join(tmpdir(), "gemini-mem-mcp-http-init-"));
  const server = await startHttpServer(tempDir);

  try {
    const initialize = await server.call({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: { name: "test", version: "0.0.1" }
      }
    });
    assert.equal(initialize.status, 200);
    assert.equal(initialize.body.result.protocolVersion, "2025-03-26");

    const tools = await server.call({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list",
      params: {}
    });
    assert.equal(tools.status, 200);
    const names = tools.body.result.tools.map((tool) => tool.name);
    assert.ok(names.includes("memory_get_context"));
  } finally {
    await server.close();
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("MCP HTTP tools/call save and search", async () => {
  const tempDir = mkdtempSync(join(tmpdir(), "gemini-mem-mcp-http-flow-"));
  const server = await startHttpServer(tempDir);

  try {
    await server.call({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: { name: "test", version: "0.0.1" }
      }
    });

    const save = await server.call({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: {
        name: "memory_save_observation",
        arguments: {
          title: "HTTP memory save",
          summary: "Saved via HTTP MCP endpoint.",
          tags: ["http", "mcp"]
        }
      }
    });
    assert.equal(save.status, 200);
    assert.equal(save.body.result.structuredContent.inserted, true);

    const search = await server.call({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: {
        name: "memory_search",
        arguments: {
          query: "HTTP endpoint",
          limit: 5
        }
      }
    });
    assert.equal(search.status, 200);
    assert.equal(search.body.result.structuredContent.count >= 1, true);
  } finally {
    await server.close();
    rmSync(tempDir, { recursive: true, force: true });
  }
});
