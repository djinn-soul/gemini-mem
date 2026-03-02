"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Logger = void 0;
const node_process_1 = require("node:process");
const ORDER = {
    debug: 10,
    info: 20,
    warn: 30,
    error: 40
};
class Logger {
    level;
    constructor(level) {
        this.level = level;
    }
    debug(message) {
        this.write("debug", message);
    }
    info(message) {
        this.write("info", message);
    }
    warn(message) {
        this.write("warn", message);
    }
    error(message) {
        this.write("error", message);
    }
    write(level, message) {
        if (ORDER[level] < ORDER[this.level]) {
            return;
        }
        node_process_1.stderr.write(`[gemini-mem] [${level}] ${message}\n`);
    }
}
exports.Logger = Logger;
