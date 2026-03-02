"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readStdinJson = readStdinJson;
exports.writeHookOutput = writeHookOutput;
const node_process_1 = require("node:process");
async function readStdinJson() {
    const chunks = [];
    for await (const chunk of node_process_1.stdin) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const raw = Buffer.concat(chunks).toString("utf8").trim();
    if (!raw) {
        throw new Error("Hook input was empty.");
    }
    return JSON.parse(raw);
}
function writeHookOutput(output = {}) {
    node_process_1.stdout.write(JSON.stringify(output));
}
