import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { buildCodebaseProfile } from "./codebase-profile";

const START_MARKER = "<!-- gemini-mem:antigravity:start -->";
const END_MARKER = "<!-- gemini-mem:antigravity:end -->";

interface SyncProjectContextOptions {
  projectCwd: string;
  projectId: string;
  mcpServerUrl: string;
  sessionId: string;
  summary: string;
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength - 3)}...`;
}

function buildAntigravitySection(options: SyncProjectContextOptions): string {
  const summary = truncate(options.summary.replace(/\s+/g, " ").trim(), 380);
  const now = new Date().toISOString();
  const profile = buildCodebaseProfile(options.projectCwd);
  const stacks = profile.detectedStacks.length > 0 ? profile.detectedStacks.join(", ") : "UNCONFIRMED";
  const keyFiles = profile.keyFiles.length > 0 ? profile.keyFiles.join(", ") : "(none detected)";
  const topDirs = profile.topLevelDirs.length > 0 ? profile.topLevelDirs.join(", ") : "(none detected)";

  return [
    START_MARKER,
    "## Antigravity MCP Memory",
    "",
    "This section is managed by gemini-mem MCP for Antigravity agents.",
    "Gemini CLI hooks are separate and do not depend on this block.",
    "",
    `- Project ID: ${options.projectId}`,
    `- MCP URL: ${options.mcpServerUrl}`,
    `- Last Session: ${options.sessionId}`,
    `- Updated At: ${now}`,
    "",
    "### Required Antigravity Tool Flow",
    "1. Call `memory_get_context` at task start.",
    "2. Call `memory_save_observation` after significant steps.",
    "3. Call `memory_end_session` at task end.",
    "",
    "### Latest Session Summary",
    summary || "(empty)",
    "",
    "### Codebase Snapshot (auto)",
    `- Project Name: ${profile.projectName}`,
    `- Detected Stacks: ${stacks}`,
    `- Key Files: ${keyFiles}`,
    `- Top Directories: ${topDirs}`,
    END_MARKER
  ].join("\n");
}

export function syncAntigravityProjectContextFile(
  options: SyncProjectContextOptions
): { path: string; updated: boolean } {
  const filePath = join(options.projectCwd, "GEMINI.md");
  mkdirSync(dirname(filePath), { recursive: true });
  const section = buildAntigravitySection(options);

  let nextContent = section;
  if (existsSync(filePath)) {
    const current = readFileSync(filePath, "utf8");
    const start = current.indexOf(START_MARKER);
    const end = current.indexOf(END_MARKER);

    if (start >= 0 && end > start) {
      const endIndex = end + END_MARKER.length;
      nextContent = `${current.slice(0, start)}${section}${current.slice(endIndex)}`.trim();
      nextContent = `${nextContent}\n`;
    } else {
      nextContent = `${current.trim()}\n\n${section}\n`;
    }
  } else {
    nextContent = `# GEMINI.md\n\n${section}\n`;
  }

  const previous = existsSync(filePath) ? readFileSync(filePath, "utf8") : "";
  if (previous === nextContent) {
    return { path: filePath, updated: false };
  }

  writeFileSync(filePath, nextContent, "utf8");
  return { path: filePath, updated: true };
}
