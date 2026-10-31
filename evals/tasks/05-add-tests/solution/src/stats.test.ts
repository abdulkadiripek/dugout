import { test } from "node:test";
import assert from "node:assert/strict";
import { mean, median, spread } from "./stats.ts";

test("mean of normal input", () => {
  assert.equal(mean([1, 2, 3, 4]), 2.5);
  assert.equal(mean([-2, 2, 6]), 2);
});

test("median of odd and even lengths, unsorted input", () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, 3, 2]), 2.5);
  assert.equal(median([9, 1, 5, 7, 3]), 5);
});

test("spread of normal input", () => {
  assert.equal(spread([5, 1, 9, 3]), 8);
  assert.equal(spread([-4, 4]), 8);
});

test("single element", () => {
  assert.equal(mean([7]), 7);
  assert.equal(median([7]), 7);
  assert.equal(spread([7]), 0);
});

test("empty list throws RangeError", () => {
  assert.throws(() => mean([]), RangeError);
  assert.throws(() => median([]), RangeError);
  assert.throws(() => spread([]), RangeError);
});

test("invalid input throws TypeError", () => {
  assert.throws(() => mean([1, Number.NaN]), TypeError);
  assert.throws(() => median([1, Infinity]), TypeError);
  assert.throws(() => spread([1, "2" as unknown as number]), TypeError);
  assert.throws(() => mean(null as unknown as number[]), TypeError);
});

test("does not modify the input", () => {
  const values = [3, 1, 2];
  median(values);
  assert.deepEqual(values, [3, 1, 2]);
});
