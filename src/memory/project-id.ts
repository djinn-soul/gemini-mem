import { createHash } from "node:crypto";

export interface ProjectIdOptions {
  cwd: string;
  mode: "cwd-hash" | "manual";
  manualProjectId: string;
}

function normalizeCwd(cwd: string): string {
  return cwd.replace(/\\/g, "/").toLowerCase().trim();
}

export function resolveProjectId(options: ProjectIdOptions): string {
  if (options.mode === "manual") {
    if (!options.manualProjectId) {
      throw new Error("MEM_PROJECT_MODE is manual but MEM_PROJECT_ID is empty.");
    }

    return options.manualProjectId;
  }

  const digest = createHash("sha256").update(normalizeCwd(options.cwd)).digest("hex");
  return `cwd-${digest.slice(0, 16)}`;
}
