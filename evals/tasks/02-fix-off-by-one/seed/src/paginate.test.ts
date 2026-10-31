import { test } from "node:test";
import assert from "node:assert/strict";
import { paginate } from "./paginate.ts";

const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

test("first and middle pages are full", () => {
  assert.deepEqual(paginate(items, 1, 3), [1, 2, 3]);
  assert.deepEqual(paginate(items, 2, 3), [4, 5, 6]);
});

test("the last page returns the remaining items", () => {
  assert.deepEqual(paginate(items, 4, 3), [10]);
});
