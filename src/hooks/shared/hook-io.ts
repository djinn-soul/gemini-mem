import { stdin, stdout } from "node:process";
import type { HookOutput } from "./types";

export async function readStdinJson<TInput>(): Promise<TInput> {
  const chunks: Buffer[] = [];

  for await (const chunk of stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const raw = Buffer.concat(chunks).toString("utf8").trim();

  if (!raw) {
    throw new Error("Hook input was empty.");
  }

  return JSON.parse(raw) as TInput;
}

export function writeHookOutput(output: HookOutput = {}): void {
  stdout.write(JSON.stringify(output));
}
