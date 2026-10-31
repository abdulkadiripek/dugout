import { execFile } from "node:child_process";
import { promisify } from "node:util";

export const reviewJsonSchema = {
  type: "object", additionalProperties: false, required: ["verdict", "summary", "issues"],
  properties: {
    verdict: { type: "string", enum: ["approve", "changes_requested"] },
    summary: { type: "string" },
    issues: { type: "array", items: {
      type: "object", additionalProperties: false, required: ["file", "line", "severity", "message"],
      properties: {
        file: { type: "string" }, line: { type: ["integer", "null"] },
        severity: { type: "string", enum: ["blocker", "major", "minor", "nit"] }, message: { type: "string" },
      },
    } },
  },
} as const;

export function truncateDiff(diff: string, maxBytes = 60000): string {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 0) throw new Error("Invalid diff budget");
  const bytes = Buffer.from(diff);
  if (bytes.length <= maxBytes) return diff;
  const boundary = bytes.lastIndexOf(10, Math.min(maxBytes, bytes.length) - 1);
  const kept = maxBytes === 0 ? 0 : boundary + 1;
  return `${bytes.subarray(0, kept).toString("utf8")}[diff truncated: ${bytes.length - kept} bytes omitted]`;
}

export function buildReviewPrompt(input: { goal: string; acceptance: string[]; diff: string }): string {
  return `Review the staged diff against the goal and acceptance criteria. Return JSON with summary, issues (file, line or null, severity, message), and verdict. Request changes for blocker or major issues; otherwise approve.\n\nGoal:\n${input.goal}\n\nAcceptance:\n${input.acceptance.map(item => `- ${item}`).join("\n")}\n\nDiff:\n${truncateDiff(input.diff)}`;
}

export async function defaultGetDiff(cwd: string, baseRef: string): Promise<string> {
  const { stdout } = await promisify(execFile)("git", ["diff", "--cached", baseRef, "--"], { cwd, maxBuffer: 64 * 1024 * 1024 });
  return stdout;
}
