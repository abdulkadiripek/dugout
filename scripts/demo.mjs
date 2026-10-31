import { execFileSync, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { createServer } from "node:net";
import { homedir } from "node:os";
import { dirname, join, resolve as resolvePath } from "node:path";
import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const serverBin = join(root, "packages/server/dist/bin.js");
const viteBin = join(root, "packages/web/node_modules/.bin/vite");
const HOST = "127.0.0.1";

const { values } = parseArgs({
  options: {
    "api-port": { type: "string", default: "4317" },
    "web-port": { type: "string", default: "5173" },
    check: { type: "boolean", default: false },
    live: { type: "boolean", default: false },
    open: { type: "boolean", default: false },
    "events-dir": { type: "string" },
    repo: { type: "string" },
  },
  strict: true,
});

function fail(message, code) {
  process.stderr.write(`demo: ${message}\n`);
  process.exit(code);
}

if (!existsSync(serverBin)) fail("packages/server/dist/bin.js is missing; run `pnpm build` first", 3);
if (!existsSync(viteBin)) fail("vite is missing; run `pnpm install` first", 3);

function tryListen(port) {
  return new Promise((resolve) => {
    const probe = createServer();
    probe.once("error", () => resolve(null));
    probe.listen(port, HOST, () => {
      const { port: actual } = probe.address();
      probe.close(() => resolve(actual));
    });
  });
}

async function freePort(requested) {
  const start = Number(requested);
  if (!Number.isInteger(start) || start < 0 || start > 65535) fail(`invalid port: ${requested}`, 3);
  if (start === 0) return tryListen(0);
  for (let port = start; port <= 65535; port++) {
    const found = await tryListen(port);
    if (found) return found;
  }
  return fail(`no free port from ${start}`, 1);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitFor(url, child, name, deadline) {
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`${name} exited early with code ${child.exitCode}`);
    try {
      const response = await fetch(url);
      if (response.ok) return response;
    } catch {}
    await sleep(200);
  }
  throw new Error(`${name} did not answer at ${url} within 20 s`);
}

function gitRoot(cwd) {
  try {
    return execFileSync("git", ["rev-parse", "--show-toplevel"], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return cwd;
  }
}

const home = homedir();
const eventsDir = values["events-dir"]
  ? resolvePath(values["events-dir"])
  : values.live
    ? join(home, ".dugout", "events")
    : join(root, "fixtures/events");
const repoDir = values.repo ? resolvePath(values.repo) : values.live ? gitRoot(process.cwd()) : root;
const shownEvents = eventsDir === home || eventsDir.startsWith(home + "/") ? `~${eventsDir.slice(home.length)}` : eventsDir;

function openBrowser(url) {
  const opener = process.platform === "darwin" ? "open" : process.platform === "linux" ? "xdg-open" : null;
  if (!opener) return;
  try {
    const child = spawn(opener, [url], { detached: true, stdio: "ignore" });
    child.on("error", () => {});
    child.unref();
  } catch {}
}

const apiPort = await freePort(values["api-port"]);
const webPort = await freePort(values["web-port"]);
const apiUrl = `http://${HOST}:${apiPort}`;
const webUrl = `http://${HOST}:${webPort}`;

const children = [];
const output = [];
function start(name, command, args, options) {
  const child = spawn(command, args, { ...options, stdio: ["ignore", "pipe", "pipe"] });
  for (const stream of [child.stdout, child.stderr]) stream.on("data", (chunk) => output.push(`[${name}] ${chunk}`));
  children.push(child);
  return child;
}

async function stopAll() {
  await Promise.all(children.map((child) => new Promise((resolve) => {
    if (child.exitCode !== null || child.signalCode !== null) return resolve();
    const timer = setTimeout(() => child.kill("SIGKILL"), 2000);
    child.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });
    child.kill("SIGTERM");
  })));
}

const api = start("api", process.execPath, [serverBin, "--port", String(apiPort), "--events-dir", eventsDir, "--repo", repoDir], { cwd: root });
const web = start("web", viteBin, ["--host", HOST, "--port", String(webPort), "--strictPort"], {
  cwd: join(root, "packages/web"),
  env: { ...process.env, DUGOUT_API: apiUrl },
});
process.stdout.write(`child pids: ${api.pid} ${web.pid}\n`);

let exitCode = 0;
try {
  const deadline = Date.now() + 20000;
  await waitFor(`${apiUrl}/api/tasks`, api, "api", deadline);
  await waitFor(webUrl, web, "web", deadline);
  process.stdout.write(`demo ready: ${webUrl}\n`);
  if (values.live || values["events-dir"]) process.stdout.write(`events: ${shownEvents}\n`);
  if (values.live) process.stdout.write("stop with Ctrl+C\n");
  if (values.open && !values.check) openBrowser(webUrl);
  if (values.check) {
    const response = await fetch(`${webUrl}/api/tasks`);
    const body = await response.json();
    const tasks = Array.isArray(body) ? body : body?.tasks;
    if (!response.ok || !Array.isArray(tasks) || tasks.length === 0) throw new Error("/api/tasks through the proxy returned no tasks");
    process.stdout.write(`demo check ok: ${tasks.length} tasks\n`);
  } else {
    await new Promise((resolve, reject) => {
      for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, resolve);
      for (const child of children) child.once("exit", () => reject(new Error("a child exited unexpectedly")));
    });
  }
} catch (error) {
  exitCode = 1;
  process.stderr.write(`demo: ${error.message}\n${output.join("")}`);
}
await stopAll();
process.exit(exitCode);
