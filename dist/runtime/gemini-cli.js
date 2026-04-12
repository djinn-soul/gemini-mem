"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runGeminiPrompt = runGeminiPrompt;
const node_child_process_1 = require("node:child_process");
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const process_1 = require("./process");
function getWindowsGeminiEntrypointCandidates(command) {
    const candidates = [];
    if ((0, node_path_1.isAbsolute)(command)) {
        candidates.push(command);
    }
    const whereCmd = (0, node_child_process_1.spawnSync)("where", ["gemini.cmd"], { encoding: "utf8" });
    if (whereCmd.status === 0 && whereCmd.stdout) {
        for (const line of whereCmd.stdout.split(/\r?\n/)) {
            const value = line.trim();
            if (value.length > 0) {
                candidates.push(value);
            }
        }
    }
    return Array.from(new Set(candidates));
}
function resolveGeminiCommand(command, args) {
    if (process.platform !== "win32") {
        return { command, args };
    }
    const base = (0, node_path_1.basename)(command).toLowerCase();
    const isGeminiShim = base === "gemini" || base === "gemini.cmd" || base === "gemini.ps1";
    if (!isGeminiShim) {
        return { command, args };
    }
    const cmdCandidates = getWindowsGeminiEntrypointCandidates(command);
    for (const cmdPath of cmdCandidates) {
        const base = (0, node_path_1.dirname)(cmdPath);
        // Try known entrypoint locations in order of preference (newer builds first)
        const candidates = [
            (0, node_path_1.join)(base, "node_modules", "@google", "gemini-cli", "bundle", "gemini.js"),
            (0, node_path_1.join)(base, "node_modules", "@google", "gemini-cli", "dist", "index.js")
        ];
        for (const geminiJsPath of candidates) {
            if ((0, node_fs_1.existsSync)(geminiJsPath)) {
                return {
                    command: process.execPath,
                    args: ["--no-warnings=DEP0040", geminiJsPath, ...args]
                };
            }
        }
    }
    return { command, args };
}
async function runGeminiPrompt(prompt, options) {
    const args = [...options.baseArgs];
    if (options.model) {
        args.push("--model", options.model);
    }
    args.push("-p", prompt);
    const resolved = resolveGeminiCommand(options.command, args);
    const result = await (0, process_1.runCommand)(resolved.command, resolved.args, {
        input: undefined,
        timeoutMs: options.timeoutMs,
        env: {
            ...process.env,
            GEMINI_MEM_INTERNAL: "1"
        }
    });
    if (result.exitCode !== 0) {
        throw new Error(`Gemini command failed (${result.exitCode}): ${result.stderr}`);
    }
    if (!result.stdout) {
        throw new Error("Gemini command returned empty stdout.");
    }
    return result.stdout;
}
