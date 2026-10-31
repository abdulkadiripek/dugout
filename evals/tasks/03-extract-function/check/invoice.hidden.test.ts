import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { formatInvoice, formatLine, formatPrice } from "./src/invoice.ts";

test("formatPrice formats cents", () => {
  assert.equal(formatPrice(0), "$0.00");
  assert.equal(formatPrice(5), "$0.05");
  assert.equal(formatPrice(100), "$1.00");
  assert.equal(formatPrice(1205), "$12.05");
  assert.equal(formatPrice(123456), "$1234.56");
  assert.equal(formatPrice(-250), "-$2.50");
  assert.equal(formatPrice(-5), "-$0.05");
});

test("formatLine output is unchanged", () => {
  assert.equal(formatLine({ name: "Pen", cents: 150, qty: 2 }), "Pen x2: $3.00");
  assert.equal(formatLine({ name: "Gift", cents: 7, qty: 1 }), "Gift x1: $0.07");
  assert.equal(formatLine({ name: "Refund", cents: -999, qty: 3 }), "Refund x3: -$29.97");
});

test("formatInvoice output is unchanged", () => {
  assert.equal(formatInvoice([]), "Total: $0.00");
  assert.equal(
    formatInvoice([
      { name: "Pen", cents: 150, qty: 2 },
      { name: "Refund", cents: -5000, qty: 1 },
    ]),
    "Pen x2: $3.00\nRefund x1: -$50.00\nTotal: -$47.00",
  );
});

test("formatPrice is defined once and used at least twice", () => {
  const source = readFileSync(new URL("./src/invoice.ts", import.meta.url), "utf8");
  const definitions = source.match(/function\s+formatPrice\b/g) ?? [];
  const calls = source.match(/\bformatPrice\s*\(/g) ?? [];
  assert.equal(definitions.length, 1);
  assert.ok(calls.length - definitions.length >= 2, "formatPrice must be called from both places");
});
