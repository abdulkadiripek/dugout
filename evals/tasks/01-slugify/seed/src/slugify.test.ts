import { test } from "node:test";
import assert from "node:assert/strict";
import { slugify } from "./slugify.ts";

test("lowercases and joins words with a dash", () => {
  assert.equal(slugify("Hello World"), "hello-world");
});
