const test = require("node:test");
const assert = require("node:assert/strict");
const { existsSync, mkdtempSync, readFileSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join, resolve } = require("node:path");
const { spawnSync } = require("node:child_process");
const { randomUUID } = require("node:crypto");
const { DatabaseSync } = require("node:sqlite");

const repoRoot = resolve(__dirname, "..");
const mockGeminiScript = resolve(repoRoot, "tests", "fixtures", "mock-gemini.cjs");
const failingGeminiScript = resolve(repoRoot, "tests", "fixtures", "failing-gemini.cjs");

function runNodeScript(scriptPath, env, inputJson) {
  const result = spawnSync(process.execPath, [scriptPath], {
    cwd: repoRoot,
    env,
    input: inputJson ? JSON.stringify(inputJson) : undefined,
    encoding: "utf8"
  });

  assert.equal(result.status, 0, `Script failed: ${scriptPath}\nSTDERR: ${result.stderr}`);

  return {
    stdout: (result.stdout || "").trim(),
    stderr: (result.stderr || "").trim()
  };
}

function buildEnv(dbPath, extra) {
  return {
    ...process.env,
    MEM_DB_PATH: dbPath,
    MEM_PROJECT_MODE: "manual",
    MEM_PROJECT_ID: "integration-project",
    MEM_LOG_LEVEL: "error",
    MEM_MODEL: "",
    MEM_GEMINI_COMMAND: process.execPath,
    MEM_GEMINI_ARGS_JSON: JSON.stringify([mockGeminiScript]),
    MEM_MAX_INJECT: "3",
    MEM_RERANK_CANDIDATES: "10",
    MEM_ENABLE_SESSIONSTART: "true",
    ...extra
  };
}

function initDb(env) {
  const script = resolve(repoRoot, "dist", "cli", "init-db.js");
  runNodeScript(script, env);
}

function seedMemory(dbPath, memory) {
  const db = new DatabaseSync(dbPath);
  db.prepare(
    `INSERT INTO memories (
      id, ts, project_id, session_id, title, type, summary,
      key_facts_json, tags_json, files_json, importance, dedupe_hash, source_hook
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    memory.id,
    memory.ts,
    memory.project_id,
    memory.session_id,
    memory.title,
    memory.type,
    memory.summary,
    JSON.stringify(memory.key_facts),
    JSON.stringify(memory.tags),
    JSON.stringify(memory.files),
    memory.importance,
    memory.dedupe_hash,
    memory.source_hook
  );

  db.prepare(
    `INSERT INTO memories_fts (id, title, summary, tags, files) VALUES (?, ?, ?, ?, ?)`
  ).run(memory.id, memory.title, memory.summary, memory.tags.join(" "), memory.files.join(" "));

  db.close();
}

test("AfterAgent stores a redacted memory card", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "gemini-mem-after-"));
  try {
    const dbPath = join(tempDir, "mem.sqlite");
    const env = buildEnv(dbPath);
    const hookScript = resolve(repoRoot, "dist", "hooks", "after-agent.js");

    const output = runNodeScript(hookScript, env, {
      prompt: "Implement parser improvements",
      prompt_response: "Completed parser update. SECRET_TOKEN present.",
      cwd: repoRoot,
      session_id: "sess-1",
      timestamp: "2026-02-25T10:00:00.000Z"
    });

    assert.equal(output.stdout, "{}");

    const db = new DatabaseSync(dbPath);
    const row = db
      .prepare("SELECT summary, key_facts_json, title FROM memories WHERE project_id = ? LIMIT 1")
      .get("integration-project");

    assert.ok(row, "Expected stored memory row");
    assert.equal(String(row.summary).includes("sk-"), false, "Summary should be redacted");

    const keyFacts = JSON.parse(String(row.key_facts_json));
    assert.equal(keyFacts.some((value) => String(value).includes("sk-")), false);
    db.close();
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("AfterAgent fail-open when Gemini subprocess fails", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "gemini-mem-after-fail-"));
  try {
    const dbPath = join(tempDir, "mem.sqlite");
    const env = buildEnv(dbPath, {
      MEM_GEMINI_ARGS_JSON: JSON.stringify([failingGeminiScript])
    });
    const hookScript = resolve(repoRoot, "dist", "hooks", "after-agent.js");

    const output = runNodeScript(hookScript, env, {
      prompt: "trigger failing gemini command",
      prompt_response: "response should not matter",
      cwd: repoRoot,
      session_id: "sess-fail",
      timestamp: "2026-02-25T10:05:00.000Z"
    });

    assert.equal(output.stdout, "{}");
    assert.ok(output.stderr.includes("AfterAgent failed"), "Expected fail-open error log");

    const db = new DatabaseSync(dbPath);
    const row = db
      .prepare("SELECT COUNT(*) AS count FROM memories WHERE project_id = ?")
      .get("integration-project");
    assert.equal(Number(row.count), 0, "No memory should be inserted on failed summarize");
    db.close();
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("AfterAgent skips writes for /mem:* command turns", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "gemini-mem-after-memcmd-"));
  try {
    const dbPath = join(tempDir, "mem.sqlite");
    const env = buildEnv(dbPath, {
      MEM_GEMINI_ARGS_JSON: JSON.stringify([failingGeminiScript])
    });
    const hookScript = resolve(repoRoot, "dist", "hooks", "after-agent.js");

    const output = runNodeScript(hookScript, env, {
      prompt: "/mem:status",
      prompt_response: "status response",
      cwd: repoRoot,
      session_id: "sess-mem-cmd",
      timestamp: "2026-02-25T10:06:00.000Z"
    });

    assert.equal(output.stdout, "{}");
    assert.equal(
      output.stderr.includes("AfterAgent failed"),
      false,
      "Mem commands should be skipped before summarize"
    );

    const statusScript = resolve(repoRoot, "dist", "commands", "mem-status.js");
    const statusOutput = runNodeScript(statusScript, env);
    const statusText = statusOutput.stdout;
    assert.ok(
      statusText.includes("Total memories: 0"),
      "No memory should be inserted for /mem:* prompts"
    );
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("BeforeAgent injects additionalContext from reranked memories", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "gemini-mem-before-"));
  try {
    const dbPath = join(tempDir, "mem.sqlite");
    const env = buildEnv(dbPath);
    initDb(env);

    seedMemory(dbPath, {
      id: randomUUID(),
      ts: "2026-02-25T10:10:00.000Z",
      project_id: "integration-project",
      session_id: "sess-2",
      title: "Migrate parser module",
      type: "task",
      summary: "before-agent-seed migration task in src/parser.ts",
      key_facts: ["Need to preserve tokenizer behavior"],
      tags: ["parser", "migration"],
      files: ["src/parser.ts"],
      importance: 5,
      dedupe_hash: `hash-${randomUUID()}`,
      source_hook: "AfterAgent"
    });

    seedMemory(dbPath, {
      id: randomUUID(),
      ts: "2026-02-25T10:11:00.000Z",
      project_id: "integration-project",
      session_id: "sess-2",
      title: "Unrelated cleanup",
      type: "fact",
      summary: "cleanup notes for docs",
      key_facts: ["README updated"],
      tags: ["docs"],
      files: ["README.md"],
      importance: 2,
      dedupe_hash: `hash-${randomUUID()}`,
      source_hook: "AfterAgent"
    });

    const hookScript = resolve(repoRoot, "dist", "hooks", "before-agent.js");
    const output = runNodeScript(hookScript, env, {
      prompt: "continue migration task for parser",
      cwd: repoRoot,
      session_id: "sess-3",
      timestamp: "2026-02-25T10:12:00.000Z"
    });

    const parsed = JSON.parse(output.stdout);
    assert.ok(parsed.hookSpecificOutput);
    const additionalContext = String(parsed.hookSpecificOutput.additionalContext || "");
    assert.ok(additionalContext.includes("Migrate parser module"));
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("SessionStart returns baseline context and respects disable flag", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "gemini-mem-session-"));
  try {
    const dbPath = join(tempDir, "mem.sqlite");
    const envEnabled = buildEnv(dbPath, { MEM_ENABLE_SESSIONSTART: "true" });
    initDb(envEnabled);

    seedMemory(dbPath, {
      id: randomUUID(),
      ts: "2026-02-25T10:20:00.000Z",
      project_id: "integration-project",
      session_id: "sess-4",
      title: "Project convention",
      type: "constraint",
      summary: "Keep modules below 300 LOC",
      key_facts: ["Split files proactively"],
      tags: ["convention"],
      files: ["src/hooks/after-agent.ts"],
      importance: 5,
      dedupe_hash: `hash-${randomUUID()}`,
      source_hook: "AfterAgent"
    });

    const hookScript = resolve(repoRoot, "dist", "hooks", "session-start.js");
    const enabledOutput = runNodeScript(hookScript, envEnabled, {
      cwd: repoRoot,
      session_id: "sess-5",
      timestamp: "2026-02-25T10:21:00.000Z"
    });

    const enabledParsed = JSON.parse(enabledOutput.stdout);
    const enabledContext = String(enabledParsed.hookSpecificOutput.additionalContext || "");
    assert.ok(enabledContext.includes("Project baseline memory"));

    const envDisabled = buildEnv(dbPath, { MEM_ENABLE_SESSIONSTART: "false" });
    const disabledOutput = runNodeScript(hookScript, envDisabled, {
      cwd: repoRoot,
      session_id: "sess-6",
      timestamp: "2026-02-25T10:22:00.000Z"
    });

    assert.equal(disabledOutput.stdout, "{}");
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("Hook telemetry writes per-project hook.log only when enabled", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "gemini-mem-telemetry-"));
  try {
    const dbRoot = join(tempDir, "db-root");
    const hookScript = resolve(repoRoot, "dist", "hooks", "session-start.js");
    const input = {
      cwd: repoRoot,
      session_id: "sess-telemetry",
      timestamp: "2026-03-02T12:00:00.000Z"
    };

    const envDisabled = buildEnv(dbRoot, {
      MEM_ENABLE_SESSIONSTART: "false",
      MEM_HOOK_TELEMETRY: "false"
    });
    runNodeScript(hookScript, envDisabled, input);

    const projectDir = join(dbRoot, "gemini_mem");
    const logPath = join(projectDir, "hook.log");
    assert.equal(existsSync(logPath), false, "Telemetry file should not exist when disabled");

    const envEnabled = buildEnv(dbRoot, {
      MEM_ENABLE_SESSIONSTART: "false",
      MEM_HOOK_TELEMETRY: "true"
    });
    runNodeScript(hookScript, envEnabled, input);

    assert.equal(existsSync(logPath), true, "Telemetry file should exist when enabled");
    const lines = readFileSync(logPath, "utf8")
      .trim()
      .split(/\r?\n/)
      .map((line) => JSON.parse(line));

    assert.ok(lines.some((line) => line.hook === "SessionStart" && line.event === "start"));
    assert.ok(lines.some((line) => line.hook === "SessionStart" && line.event === "disabled"));
    assert.ok(lines.every((line) => line.projectId === "integration-project"));
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});
