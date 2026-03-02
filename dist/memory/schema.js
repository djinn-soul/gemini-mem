"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseMemoryCard = parseMemoryCard;
const MEMORY_TYPES = ["task", "decision", "fact", "constraint", "risk", "other"];
function asRecord(value) {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        throw new Error("Memory card must be an object.");
    }
    return value;
}
function parseString(input, key, minLength, maxLength) {
    const value = input[key];
    if (typeof value !== "string") {
        throw new Error(`Memory card field '${key}' must be a string.`);
    }
    const trimmed = value.trim();
    if (trimmed.length < minLength || trimmed.length > maxLength) {
        throw new Error(`Memory card field '${key}' must be ${minLength}-${maxLength} characters.`);
    }
    return trimmed;
}
function parseStringArray(input, key, minItems, maxItems, minLength, maxLength) {
    const value = input[key];
    if (!Array.isArray(value)) {
        throw new Error(`Memory card field '${key}' must be an array.`);
    }
    if (value.length < minItems || value.length > maxItems) {
        throw new Error(`Memory card field '${key}' must contain ${minItems}-${maxItems} items.`);
    }
    const normalized = value.map((item, index) => {
        if (typeof item !== "string") {
            throw new Error(`Memory card field '${key}[${index}]' must be a string.`);
        }
        const trimmed = item.trim();
        if (trimmed.length < minLength || trimmed.length > maxLength) {
            throw new Error(`Memory card field '${key}[${index}]' must be ${minLength}-${maxLength} characters.`);
        }
        return trimmed;
    });
    return Array.from(new Set(normalized));
}
function parseMemoryType(input) {
    const value = input.type;
    if (typeof value !== "string" || !MEMORY_TYPES.includes(value)) {
        throw new Error("Memory card field 'type' must be a valid memory type.");
    }
    return value;
}
function parseImportance(input) {
    const value = input.importance;
    if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 5) {
        throw new Error("Memory card field 'importance' must be an integer between 1 and 5.");
    }
    return value;
}
function parseMemoryCard(value) {
    const input = asRecord(value);
    return {
        title: parseString(input, "title", 3, 160),
        type: parseMemoryType(input),
        summary: parseString(input, "summary", 12, 1200),
        key_facts: parseStringArray(input, "key_facts", 1, 10, 2, 220),
        tags: parseStringArray(input, "tags", 0, 12, 2, 50),
        files: parseStringArray(input, "files", 0, 20, 1, 260),
        importance: parseImportance(input)
    };
}
