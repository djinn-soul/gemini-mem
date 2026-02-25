#!/usr/bin/env node

function readPromptFromArgs(argv) {
  const promptIndex = argv.indexOf("-p");
  if (promptIndex === -1 || promptIndex + 1 >= argv.length) {
    return "";
  }

  return argv[promptIndex + 1] ?? "";
}

function extractCandidateIds(prompt) {
  const matches = [...prompt.matchAll(/id:\s*([^\n\r]+)/g)];
  return matches.map((match) => (match[1] || "").trim()).filter((id) => id.length > 0);
}

const prompt = readPromptFromArgs(process.argv.slice(2));

if (prompt.includes("You rank candidate memories")) {
  const ids = extractCandidateIds(prompt);
  process.stdout.write(JSON.stringify({ selected_ids: ids.slice(0, 1) }));
  process.exit(0);
}

if (prompt.includes("memory extraction engine")) {
  const isSeed = prompt.includes("before-agent-seed");
  const payload = {
    title: isSeed ? "BeforeAgent Seed Memory" : "AfterAgent Stored Memory",
    type: "task",
    summary: "Captured implementation details with sk-ABCDEFGHIJKLMNOPQRSTUVWX",
    key_facts: [
      "Primary file changed: src/app.ts",
      "Observed token sk-ABCDEFGHIJKLMNOPQRSTUVWX"
    ],
    tags: ["memory", "integration"],
    files: ["src/app.ts"],
    importance: 4
  };

  process.stdout.write(JSON.stringify(payload));
  process.exit(0);
}

process.stdout.write("{}\n");
