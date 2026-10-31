function validate(values: number[]): void {
  if (!Array.isArray(values)) throw new TypeError("values must be an array");
  for (const value of values) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new TypeError("values must be finite numbers");
    }
  }
}

export function mean(values: number[]): number {
  validate(values);
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function median(values: number[]): number {
  validate(values);
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid] as number;
  return ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2;
}

export function spread(values: number[]): number {
  validate(values);
  return Math.max(...values) - Math.min(...values);
}
