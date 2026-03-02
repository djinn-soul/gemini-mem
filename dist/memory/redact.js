"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.redactText = redactText;
exports.redactMemoryCard = redactMemoryCard;
const SECRET_PATTERNS = [
    /AIza[0-9A-Za-z\-_]{35}/g,
    /\bghp_[A-Za-z0-9]{36}\b/g,
    /\bsk-[A-Za-z0-9]{20,}\b/g,
    /\bAKIA[0-9A-Z]{16}\b/g,
    /-----BEGIN [A-Z ]+ PRIVATE KEY-----[\s\S]*?-----END [A-Z ]+ PRIVATE KEY-----/g
];
function redactText(value) {
    let redacted = value;
    for (const pattern of SECRET_PATTERNS) {
        redacted = redacted.replace(pattern, "[REDACTED]");
    }
    return redacted;
}
function redactMemoryCard(card) {
    return {
        ...card,
        title: redactText(card.title),
        summary: redactText(card.summary),
        key_facts: card.key_facts.map(redactText),
        tags: card.tags.map(redactText),
        files: card.files.map(redactText)
    };
}
