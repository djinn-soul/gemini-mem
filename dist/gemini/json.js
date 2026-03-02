"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractJsonObject = extractJsonObject;
function extractJsonObject(text) {
    const fenced = text.match(/```json\s*([\s\S]*?)```/i);
    if (fenced && fenced[1]) {
        return fenced[1].trim();
    }
    const firstBrace = text.indexOf("{");
    const lastBrace = text.lastIndexOf("}");
    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
        throw new Error("No JSON object found in model output.");
    }
    return text.slice(firstBrace, lastBrace + 1).trim();
}
