import { basename, isAbsolute, join, resolve } from "node:path";
import { homedir } from "node:os";

const SQLITE_FILE_SUFFIXES = [".db", ".sqlite", ".sqlite3"];

function expandHome(pathValue: string): string {
  if (pathValue === "~") {
    return homedir();
  }

  if (pathValue.startsWith("~/") || pathValue.startsWith("~\\")) {
    return join(homedir(), pathValue.slice(2));
  }

  return pathValue;
}

function looksLikeSqliteFile(pathValue: string): boolean {
  const lower = pathValue.toLowerCase();
  return SQLITE_FILE_SUFFIXES.some((suffix) => lower.endsWith(suffix));
}

function sanitizeProjectFolderName(cwd: string): string {
  const folder = basename(cwd.trim()) || "project";
  const sanitized = folder.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-");
  return sanitized || "project";
}

export function resolveMemoryDbPath(dbPathSetting: string, projectCwd: string): string {
  const trimmedSetting = dbPathSetting.trim();
  if (!trimmedSetting) {
    throw new Error("MEM_DB_PATH must not be empty.");
  }

  const expanded = expandHome(trimmedSetting);
  const absolute = isAbsolute(expanded) ? expanded : resolve(projectCwd, expanded);

  if (looksLikeSqliteFile(absolute)) {
    return absolute;
  }

  const projectFolder = sanitizeProjectFolderName(projectCwd);
  return join(absolute, projectFolder, "memory.db");
}
