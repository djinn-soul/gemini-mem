"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runCommand = runCommand;
const node_child_process_1 = require("node:child_process");
async function runCommand(command, args, options) {
    return new Promise((resolve, reject) => {
        const child = (0, node_child_process_1.spawn)(command, args, {
            env: options.env ?? process.env,
            stdio: ["pipe", "pipe", "pipe"]
        });
        const stdoutChunks = [];
        const stderrChunks = [];
        const timer = setTimeout(() => {
            child.kill("SIGTERM");
            reject(new Error(`Command timed out after ${options.timeoutMs}ms: ${command}`));
        }, options.timeoutMs);
        child.stdout.on("data", (chunk) => stdoutChunks.push(chunk));
        child.stderr.on("data", (chunk) => stderrChunks.push(chunk));
        child.on("error", (error) => {
            clearTimeout(timer);
            reject(error);
        });
        child.on("close", (code) => {
            clearTimeout(timer);
            resolve({
                stdout: Buffer.concat(stdoutChunks).toString("utf8").trim(),
                stderr: Buffer.concat(stderrChunks).toString("utf8").trim(),
                exitCode: code ?? -1
            });
        });
        if (options.input) {
            child.stdin.write(options.input);
        }
        child.stdin.end();
    });
}
