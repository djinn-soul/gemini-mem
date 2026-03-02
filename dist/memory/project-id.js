"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveProjectId = resolveProjectId;
const node_crypto_1 = require("node:crypto");
function normalizeCwd(cwd) {
    return cwd.replace(/\\/g, "/").toLowerCase().trim();
}
function resolveProjectId(options) {
    if (options.mode === "manual") {
        if (!options.manualProjectId) {
            throw new Error("MEM_PROJECT_MODE is manual but MEM_PROJECT_ID is empty.");
        }
        return options.manualProjectId;
    }
    const digest = (0, node_crypto_1.createHash)("sha256").update(normalizeCwd(options.cwd)).digest("hex");
    return `cwd-${digest.slice(0, 16)}`;
}
