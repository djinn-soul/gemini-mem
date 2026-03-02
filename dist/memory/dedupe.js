"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildDedupeHash = buildDedupeHash;
const node_crypto_1 = require("node:crypto");
function normalizeList(values) {
    return values
        .map((value) => value.trim().toLowerCase())
        .filter((value) => value.length > 0)
        .sort()
        .join("|");
}
function buildDedupeHash(projectId, card) {
    const payload = [
        projectId,
        card.title.trim().toLowerCase(),
        card.type,
        card.summary.trim().toLowerCase(),
        normalizeList(card.key_facts),
        normalizeList(card.tags),
        normalizeList(card.files)
    ].join("||");
    return (0, node_crypto_1.createHash)("sha256").update(payload).digest("hex");
}
