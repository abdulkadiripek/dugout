export interface Item {
  name: string;
  cents: number;
  qty: number;
}

export function formatLine(item: Item): string {
  const total = item.cents * item.qty;
  const sign = total < 0 ? "-" : "";
  const abs = Math.abs(total);
  const price = `${sign}$${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
  return `${item.name} x${item.qty}: ${price}`;
}

export function formatInvoice(items: Item[]): string {
  const lines = items.map(formatLine);
  const total = items.reduce((sum, item) => sum + item.cents * item.qty, 0);
  const sign = total < 0 ? "-" : "";
  const abs = Math.abs(total);
  const price = `${sign}$${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
  return [...lines, `Total: ${price}`].join("\n");
}
