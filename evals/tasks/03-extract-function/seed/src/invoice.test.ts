import { test } from "node:test";
import assert from "node:assert/strict";
import { formatInvoice, formatLine } from "./invoice.ts";

test("formats a line", () => {
  assert.equal(formatLine({ name: "Pen", cents: 150, qty: 2 }), "Pen x2: $3.00");
});

test("formats an invoice with a total", () => {
  const out = formatInvoice([
    { name: "Pen", cents: 150, qty: 2 },
    { name: "Ink", cents: 1205, qty: 1 },
  ]);
  assert.equal(out, "Pen x2: $3.00\nInk x1: $12.05\nTotal: $15.05");
});
