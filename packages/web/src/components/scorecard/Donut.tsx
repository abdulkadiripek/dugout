import { donutArcPath, percent } from "./geometry.js";

export function Donut({ rate }: { rate: number }) {
  const path = donutArcPath(rate, 42, 42, 34);
  return (
    <svg width="84" height="84" viewBox="0 0 84 84" role="img" aria-label={`First-try pass rate ${percent(rate)}`}>
      <circle cx="42" cy="42" r="34" fill="none" stroke="var(--soft)" strokeWidth="10" />
      {path && <path d={path} fill="none" stroke="var(--dot-passed)" strokeWidth="10" strokeLinecap="round" />}
    </svg>
  );
}
