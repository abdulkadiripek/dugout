#!/usr/bin/env node
import { execFile } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { startServer } from "./server.js";

function gitRoot(cwd: string): Promise<string> {
  return new Promise((resolve) => {
    execFile("git", ["rev-parse", "--show-toplevel"], { cwd, encoding: "utf8" }, (error, stdout) => {
      resolve(error ? cwd : stdout.trim());
    });
  });
}

function usageError(message: string): never {
  process.stderr.write(`dugout-serve: ${message}\n`);
  process.exit(3);
}

let values;
try {
  ({ values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      port: { type: "string", default: "4317" },
      "events-dir": { type: "string" },
      repo: { type: "string" },
    },
    strict: true,
    allowPositionals: false,
  }));
} catch (error) {
  usageError(error instanceof Error ? error.message : String(error));
}

const port = /^\d+$/.test(values.port) ? Number(values.port) : NaN;
if (!(port >= 0 && port <= 65535)) usageError(`invalid --port: ${values.port}`);

const server = await startServer({
  port,
  eventsDir: values["events-dir"] ?? join(homedir(), ".dugout", "events"),
  repo: values.repo ?? (await gitRoot(process.cwd())),
});
process.stdout.write(`listening on http://${server.address.host}:${server.address.port}\n`);

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    void server.close().then(() => process.exit(0));
  });
}
