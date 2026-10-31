import { execFile } from "node:child_process";

export const MAX_DIFF_BYTES = 200000;
const MAX_BUFFER = 256 * 1024 * 1024;
const REF_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/;

export const isValidRef = (ref: string): boolean => REF_PATTERN.test(ref) && !ref.includes("..");

export interface DiffResult {
  diff: string;
  truncated: boolean;
  bytes: number;
}

export function truncateDiff(full: Buffer): DiffResult {
  const bytes = full.length;
  if (bytes <= MAX_DIFF_BYTES) return { diff: full.toString("utf8"), truncated: false, bytes };
  const cut = full.subarray(0, MAX_DIFF_BYTES).lastIndexOf(0x0a) + 1;
  const omitted = bytes - cut;
  const kept = full.subarray(0, cut).toString("utf8");
  return { diff: `${kept}[diff truncated: ${omitted} bytes omitted]`, truncated: true, bytes };
}

export function gitDiff(repo: string, baseRef: string, branch: string): Promise<DiffResult | null> {
  if (!isValidRef(baseRef) || !isValidRef(branch)) return Promise.resolve(null);
  const args = ["diff", "--no-color", "--no-ext-diff", "--no-textconv", "--end-of-options", `${baseRef}...${branch}`, "--"];
  return new Promise((resolve) => {
    execFile("git", args, { cwd: repo, encoding: "buffer", maxBuffer: MAX_BUFFER }, (error, stdout) => {
      resolve(error ? null : truncateDiff(stdout));
    });
  });
}
