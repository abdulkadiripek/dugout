export interface Item {
  name: string;
  cents: number;
  qty: number;
}

export function formatPrice(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${sign}$${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

export function formatLine(item: Item): string {
  return `${item.name} x${item.qty}: ${formatPrice(item.cents * item.qty)}`;
}

export function formatInvoice(items: Item[]): string {
  const lines = items.map(formatLine);
  const total = items.reduce((sum, item) => sum + item.cents * item.qty, 0);
  return [...lines, `Total: ${formatPrice(total)}`].join("\n");
}
