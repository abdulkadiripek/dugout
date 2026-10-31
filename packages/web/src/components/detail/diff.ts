export type DiffLine = { kind: "add" | "del" | "ctx" | "note"; text: string; oldNo: number | null; newNo: number | null };
export type DiffHunk = { header: string; lines: DiffLine[] };
export type DiffFile = { path: string; binary: boolean; notes: string[]; hunks: DiffHunk[] };
export type ParsedDiff = { files: DiffFile[]; truncation: string | null };

const TRUNCATED = /^\[diff truncated: .*\]$/;
const HUNK = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;

function pathFromHeader(line: string): string {
  const m = /^diff --git a\/(.+) b\/(.+)$/.exec(line);
  return m?.[2] ?? line.replace(/^diff --git /, "");
}

export function parseDiff(text: string): ParsedDiff {
  const files: DiffFile[] = [];
  let truncation: string | null = null;
  let file: DiffFile | null = null;
  let hunk: DiffHunk | null = null;
  let oldNo = 0;
  let newNo = 0;
  let oldLeft = 0;
  let newLeft = 0;

  const lines = text.split("\n");
  if (lines[lines.length - 1] === "") lines.pop();

  for (const line of lines) {
    if (TRUNCATED.test(line)) {
      truncation = line;
      continue;
    }
    const inHunk = hunk !== null && (oldLeft > 0 || newLeft > 0);
    if (inHunk && hunk) {
      const c = line[0];
      if (c === "+") {
        hunk.lines.push({ kind: "add", text: line.slice(1), oldNo: null, newNo: newNo++ });
        newLeft--;
        continue;
      }
      if (c === "-") {
        hunk.lines.push({ kind: "del", text: line.slice(1), oldNo: oldNo++, newNo: null });
        oldLeft--;
        continue;
      }
      if (c === " " || line === "") {
        hunk.lines.push({ kind: "ctx", text: line.slice(1), oldNo: oldNo++, newNo: newNo++ });
        oldLeft--;
        newLeft--;
        continue;
      }
    }
    if (line.startsWith("\\") && hunk) {
      hunk.lines.push({ kind: "note", text: line, oldNo: null, newNo: null });
      continue;
    }
    if (line.startsWith("diff --git ")) {
      file = { path: pathFromHeader(line), binary: false, notes: [], hunks: [] };
      files.push(file);
      hunk = null;
      oldLeft = newLeft = 0;
      continue;
    }
    if (!file) continue;
    const h = HUNK.exec(line);
    if (h) {
      oldNo = Number(h[1]);
      newNo = Number(h[3]);
      oldLeft = h[2] === undefined ? 1 : Number(h[2]);
      newLeft = h[4] === undefined ? 1 : Number(h[4]);
      hunk = { header: line, lines: [] };
      file.hunks.push(hunk);
      continue;
    }
    if (line.startsWith("Binary files ") || line.startsWith("GIT binary patch")) {
      file.binary = true;
      continue;
    }
    if (line.startsWith("--- ") || line.startsWith("+++ ") || line === "") continue;
    file.notes.push(line);
  }
  return { files, truncation };
}
