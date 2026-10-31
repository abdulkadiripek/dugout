import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const distEntry = join(root, "packages/core/dist/index.js");
if (!existsSync(distEntry)) {
  console.error("packages/core/dist is missing: run `pnpm build` first.");
  process.exit(1);
}
const { parseLog, summarizeLog, computeScorecard } = await import(pathToFileURL(distEntry).href);

const eventsDir = join(root, "fixtures/events");
const outDir = join(root, "docs/design/prototypes");
const templatesDir = join(outDir, "templates");

const tasks = [];
const finished = [];
const excluded = { interrupted: 0, unreadable: 0 };
for (const file of readdirSync(eventsDir).filter((name) => name.endsWith(".jsonl")).sort()) {
  const lines = readFileSync(join(eventsDir, file), "utf8").split("\n").filter((line) => line.length > 0);
  const name = file.replace(/\.jsonl$/, "");
  const summary = summarizeLog(lines, name);
  const parsed = parseLog(lines);
  const events = parsed.ok ? parsed.events : [];
  tasks.push({ summary, events });
  if (summary.status === "unreadable") excluded.unreadable += 1;
  else if (summary.status === "interrupted") excluded.interrupted += 1;
  else finished.push(events);
}
tasks.sort((a, b) => b.summary.startedAt.localeCompare(a.summary.startedAt) || a.summary.taskId.localeCompare(b.summary.taskId));

const data = { tasks, scorecard: computeScorecard({ logs: finished, excluded }) };
const blob = JSON.stringify(data).replace(/</g, "\\u003c").replace(/[\u2028\u2029]/g, (c) => "\\u" + c.charCodeAt(0).toString(16));
const shared = readFileSync(join(templatesDir, "shared.js"), "utf8");

for (const name of ["dense", "airy"]) {
  const template = readFileSync(join(templatesDir, `${name}.html`), "utf8");
  const html = template
    .replace("/*{{SHARED_JS}}*/", () => shared)
    .replace("/*{{DATA}}*/null", () => blob);
  writeFileSync(join(outDir, `${name}.html`), html);
  console.log(`wrote docs/design/prototypes/${name}.html (${html.length} bytes)`);
}
