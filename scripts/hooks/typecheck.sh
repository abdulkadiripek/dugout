#!/usr/bin/env bash
# PostToolUse hook: typecheck the package that contains the edited file.
# Silent no-op until a tsconfig.json and installed dependencies exist.
set -u

root="${CLAUDE_PROJECT_DIR:-$(pwd)}"
file="$(python3 -c 'import json,sys
try:
    print(json.load(sys.stdin).get("tool_input", {}).get("file_path", ""))
except Exception:
    print("")' 2>/dev/null)"

[ -n "$file" ] || exit 0
case "$file" in
  *.ts|*.tsx) ;;
  *) exit 0 ;;
esac
case "$file" in
  "$root"/*) ;;
  *) exit 0 ;;
esac

dir="$(dirname "$file")"
while [ "$dir" != "$root" ] && [ "$dir" != "/" ]; do
  [ -f "$dir/tsconfig.json" ] && break
  dir="$(dirname "$dir")"
done
[ -f "$dir/tsconfig.json" ] || exit 0
[ -d "$root/node_modules" ] || exit 0
command -v pnpm >/dev/null 2>&1 || exit 0

out="$(cd "$dir" && pnpm exec tsc --noEmit -p tsconfig.json 2>&1)"
status=$?
if [ $status -ne 0 ]; then
  printf 'Typecheck failed in %s:\n%s\n' "${dir#"$root"/}" "$(printf '%s\n' "$out" | head -n 30)" >&2
  exit 2
fi
exit 0
