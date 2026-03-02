const { readdirSync, readFileSync, statSync } = require("node:fs");
const { join, extname } = require("node:path");

const ROOT = process.cwd();
const MAX_LINES = 300;
const ALLOWED_EXTENSIONS = new Set([".ts"]);
const IGNORE_DIRS = new Set([".git", "node_modules", "dist", "out"]);

function walk(dir, files) {
  const entries = readdirSync(dir);
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      if (!IGNORE_DIRS.has(entry)) {
        walk(fullPath, files);
      }
      continue;
    }

    if (ALLOWED_EXTENSIONS.has(extname(entry))) {
      files.push(fullPath);
    }
  }
}

function lineCount(path) {
  const content = readFileSync(path, "utf8");
  if (content.length === 0) {
    return 0;
  }
  return content.split(/\r?\n/).length;
}

const files = [];
walk(join(ROOT, "src"), files);

const violations = files
  .map((file) => ({ file, lines: lineCount(file) }))
  .filter((item) => item.lines > MAX_LINES);

if (violations.length > 0) {
  console.error(`Found TypeScript files over ${MAX_LINES} lines:`);
  for (const violation of violations) {
    console.error(`- ${violation.file}: ${violation.lines}`);
  }
  process.exit(1);
}

console.log(`Line check passed (${files.length} files in src, max ${MAX_LINES} lines).`);
