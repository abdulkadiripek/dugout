export function formatDuration(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  if (value < 1000) return `${Math.round(value)}ms`;
  const s = value / 1000;
  if (s < 60) return `${s < 10 ? s.toFixed(1) : Math.round(s)}s`;
  let m = Math.floor(s / 60);
  let rest = Math.round(s - m * 60);
  if (rest === 60) {
    m += 1;
    rest = 0;
  }
  if (m < 60) return `${m}m ${String(rest).padStart(2, "0")}s`;
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;
}

export function formatCount(value: number): string {
  if (value >= 10000) return `${(value / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return value.toLocaleString("en-US");
}

export function formatTokens(tokens: { input: number; output: number }) {
  return {
    input: formatCount(tokens.input),
    output: formatCount(tokens.output),
    total: formatCount(tokens.input + tokens.output),
  };
}

export function formatDate(iso: string | null | undefined): string {
  return iso ? iso.slice(0, 10) : "—";
}

export function formatDateTime(iso: string | null | undefined): string {
  return iso ? `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC` : "—";
}
