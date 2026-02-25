import { spawn } from "node:child_process";

export interface CommandRunOptions {
  input?: string;
  timeoutMs: number;
  env?: NodeJS.ProcessEnv;
}

export interface CommandRunResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export async function runCommand(
  command: string,
  args: string[],
  options: CommandRunOptions
): Promise<CommandRunResult> {
  return new Promise<CommandRunResult>((resolve, reject) => {
    const child = spawn(command, args, {
      env: options.env ?? process.env,
      stdio: ["pipe", "pipe", "pipe"]
    });

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`Command timed out after ${options.timeoutMs}ms: ${command}`));
    }, options.timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => stdoutChunks.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderrChunks.push(chunk));

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
