const clamp01 = (value: number) => (Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0);
const fix = (value: number) => String(Math.round(value * 100) / 100);

export function donutArcPath(rate: number, cx: number, cy: number, r: number): string {
  const f = clamp01(rate);
  if (f === 0) return "";
  const top = `${fix(cx)} ${fix(cy - r)}`;
  if (f === 1) {
    return `M ${top} A ${r} ${r} 0 1 1 ${fix(cx)} ${fix(cy + r)} A ${r} ${r} 0 1 1 ${top}`;
  }
  const angle = f * 2 * Math.PI;
  const x = cx + r * Math.sin(angle);
  const y = cy - r * Math.cos(angle);
  return `M ${top} A ${r} ${r} 0 ${f > 0.5 ? 1 : 0} 1 ${fix(x)} ${fix(y)}`;
}

export function barWidths(values: readonly number[], max: number): number[] {
  if (!(max > 0)) return values.map(() => 0);
  return values.map((value) => Math.round(clamp01(value / max) * 10000) / 100);
}

export function percent(rate: number): string {
  return `${Math.round(clamp01(rate) * 100)}%`;
}

export function formatDecimal(value: number): string {
  return String(Math.round(value * 100) / 100);
}
