import { execFileSync } from "node:child_process";
import { lstatSync, readFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const MAX_BYTES = 1024 * 1024;
const ALLOWED_HOME_NAMES = new Set(["runner", "user"]);
const ALLOWED_EMAIL_SUFFIXES = ["@localhost", "@example.com", "@users.noreply.github.com"];

const contentRules = [
  {
    rule: "home-path",
    pattern: /(?:\/home\/|\/Users\/|[A-Za-z]:\\Users\\)([A-Za-z0-9._-]+)[/\\]/g,
    allow: (match) => ALLOWED_HOME_NAMES.has(match[1] ?? "") && match[0].startsWith("/home/"),
  },
  {
    rule: "email",
    pattern: /[A-Za-z0-9._%+-]+@[A-Za-z][A-Za-z0-9-]*(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g,
    allow: (match) => ALLOWED_EMAIL_SUFFIXES.some((suffix) => match[0].toLowerCase().endsWith(suffix)),
  },
  { rule: "openai-key", pattern: /\bsk-[A-Za-z0-9]{20,}/g },
  { rule: "github-token", pattern: /\b(?:ghp|gho)_[A-Za-z0-9]{20,}|\bgithub_pat_[A-Za-z0-9_]{20,}/g },
  { rule: "aws-access-key", pattern: /\bAKIA[A-Z0-9]{16}\b/g },
  { rule: "private-key", pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g },
  { rule: "slack-token", pattern: /\bxox[baprs]-[A-Za-z0-9-]{10,}/g },
];

function localOnlyRule(file) {
  const name = basename(file);
  if (name === ".env" || (name.startsWith(".env.") && name !== ".env.example")) return "tracked-env-file";
  if (name === "CLAUDE.local.md") return "tracked-local-file";
  if (file === ".proje" || file.startsWith(".proje/")) return "tracked-local-file";
  if (file === ".claude/settings.local.json") return "tracked-local-file";
  return null;
}

const preview = (text) => `${text.slice(0, 4)}…`;

function isBinary(buffer) {
  return buffer.subarray(0, 8000).includes(0);
}

export function scan(repoDir) {
  const root = resolve(repoDir);
  const listing = execFileSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  const findings = [];

  for (const file of listing.split("\0").filter((entry) => entry.length > 0)) {
    const local = localOnlyRule(file);
    if (local) findings.push({ file, line: 0, rule: local, preview: preview(basename(file)) });

    let buffer;
    try {
      const path = join(root, file);
      const stat = lstatSync(path);
      if (!stat.isFile() || stat.size > MAX_BYTES) continue;
      buffer = readFileSync(path);
    } catch {
      continue;
    }
    if (isBinary(buffer)) continue;

    const lines = buffer.toString("utf8").split("\n");
    lines.forEach((text, index) => {
      for (const { rule, pattern, allow } of contentRules) {
        for (const match of text.matchAll(pattern)) {
          if (allow?.(match)) continue;
          findings.push({ file, line: index + 1, rule, preview: preview(match[0]) });
        }
      }
    });
  }
  return findings;
}

function defaultDir() {
  return execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let findings;
  try {
    findings = scan(process.argv[2] ?? defaultDir());
  } catch (error) {
    console.error(`scan-repo: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(2);
  }
  for (const f of findings) console.log(`${f.file}:${f.line} ${f.rule} ${f.preview}`);
  console.log(findings.length === 0 ? "scan-repo: clean" : `scan-repo: ${findings.length} finding(s)`);
  process.exit(findings.length === 0 ? 0 : 1);
}
