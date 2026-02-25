import { stderr } from "node:process";
import type { LogLevel } from "./types";

const ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
};

export class Logger {
  private readonly level: LogLevel;

  constructor(level: LogLevel) {
    this.level = level;
  }

  debug(message: string): void {
    this.write("debug", message);
  }

  info(message: string): void {
    this.write("info", message);
  }

  warn(message: string): void {
    this.write("warn", message);
  }

  error(message: string): void {
    this.write("error", message);
  }

  private write(level: LogLevel, message: string): void {
    if (ORDER[level] < ORDER[this.level]) {
      return;
    }

    stderr.write(`[gemini-mem] [${level}] ${message}\n`);
  }
}
