import { existsSync, readdirSync } from "node:fs";
import { basename, join } from "node:path";

export interface CodebaseProfile {
  projectName: string;
  detectedStacks: string[];
  keyFiles: string[];
  topLevelDirs: string[];
}

interface StackSignal {
  file: string;
  stack: string;
}

const STACK_SIGNALS: StackSignal[] = [
  { file: "package.json", stack: "Node.js/TypeScript" },
  { file: "pyproject.toml", stack: "Python" },
  { file: "requirements.txt", stack: "Python" },
  { file: "go.mod", stack: "Go" },
  { file: "Cargo.toml", stack: "Rust" },
  { file: "pom.xml", stack: "Java" },
  { file: "build.gradle", stack: "Java/Kotlin" },
  { file: "build.gradle.kts", stack: "Kotlin" },
  { file: "Gemfile", stack: "Ruby" },
  { file: "composer.json", stack: "PHP" }
];

const PRIORITY_FILES = [
  "GEMINI.md",
  "README.md",
  "AGENTS.md",
  "package.json",
  "pyproject.toml",
  "go.mod",
  "Cargo.toml",
  "docker-compose.yml",
  "Dockerfile"
];

function listTopLevelDirs(projectCwd: string): string[] {
  try {
    return readdirSync(projectCwd, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .filter((name) => !name.startsWith(".") && name !== "node_modules")
      .slice(0, 12);
  } catch {
    return [];
  }
}

function listKeyFiles(projectCwd: string): string[] {
  return PRIORITY_FILES.filter((file) => existsSync(join(projectCwd, file)));
}

function detectStacks(projectCwd: string): string[] {
  const stacks = new Set<string>();
  for (const signal of STACK_SIGNALS) {
    if (existsSync(join(projectCwd, signal.file))) {
      stacks.add(signal.stack);
    }
  }
  return Array.from(stacks);
}

export function buildCodebaseProfile(projectCwd: string): CodebaseProfile {
  return {
    projectName: basename(projectCwd),
    detectedStacks: detectStacks(projectCwd),
    keyFiles: listKeyFiles(projectCwd),
    topLevelDirs: listTopLevelDirs(projectCwd)
  };
}
