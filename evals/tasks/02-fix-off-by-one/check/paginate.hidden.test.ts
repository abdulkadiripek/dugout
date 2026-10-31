import { test } from "node:test";
import assert from "node:assert/strict";
import { paginate } from "./src/paginate.ts";

function range(n: number): number[] {
  return Array.from({ length: n }, (_, i) => i);
}

test("pages concatenate back to the original list", () => {
  for (const count of [0, 1, 2, 5, 9, 10, 11]) {
    for (const size of [1, 2, 3, 5, 10]) {
      const items = range(count);
      const pages = Math.ceil(count / size);
      const joined: number[] = [];
      for (let page = 1; page <= pages; page++) {
        const slice = paginate(items, page, size);
        assert.ok(slice.length <= size, `page ${page} too long`);
        assert.ok(slice.length > 0, `page ${page} empty`);
        joined.push(...slice);
      }
      assert.deepEqual(joined, items, `count=${count} size=${size}`);
    }
  }
});

test("exact multiple keeps the final full page", () => {
  assert.deepEqual(paginate(range(9), 3, 3), [6, 7, 8]);
});

test("a page past the end is empty", () => {
  assert.deepEqual(paginate(range(5), 3, 3), []);
});

test("does not modify the input", () => {
  const items = range(4);
  paginate(items, 2, 3);
  assert.deepEqual(items, [0, 1, 2, 3]);
});
