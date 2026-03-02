const { existsSync } = require("node:fs");
const { join, resolve } = require("node:path");
const { spawnSync } = require("node:child_process");

const HOOK_FILES = {
  "after-agent": "after-agent.js",
  "before-agent": "before-agent.js",
  "session-start": "session-start.js"
};

function readStdin() {
  return new Promise((resolvePromise, rejectPromise) => {
    const chunks = [];
    process.stdin.on("data", (chunk) => chunks.push(chunk));
    process.stdin.on("end", () => resolvePromise(Buffer.concat(chunks)));
    process.stdin.on("error", rejectPromise);
  });
}

function failOpen(message) {
  process.stderr.write(`[gemini-mem] [error] ${message}\n`);
  process.stdout.write("{}");
  process.exit(0);
}

async function main() {
  const hookName = process.argv[2];
  if (!hookName || !Object.prototype.hasOwnProperty.call(HOOK_FILES, hookName)) {
    failOpen(`Invalid hook runner target "${hookName ?? ""}".`);
  }

  const extensionRoot = resolve(__dirname, "..");
  const target = join(extensionRoot, "dist", "hooks", HOOK_FILES[hookName]);

  if (!existsSync(target)) {
    failOpen(
      `Missing compiled hook file at "${target}". Reinstall or update gemini-mem extension (release with dist/).`
    );
  }

  const input = await readStdin();
  const result = spawnSync(process.execPath, [target], {
    input,
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024
  });

  if (result.stderr) {
    process.stderr.write(result.stderr);
  }

  const stdout = result.stdout ?? "";
  if (result.error) {
    failOpen(`Hook process failed for ${hookName}: ${result.error.message}`);
  }

  if (result.status !== 0) {
    failOpen(`Hook process exited with code ${result.status} for ${hookName}.`);
  }

  process.stdout.write(stdout.trim().length > 0 ? stdout : "{}");
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  failOpen(`Unhandled hook runner failure: ${message}`);
});
