import { test } from "node:test";
import assert from "node:assert/strict";
import { slugify } from "./src/slugify.ts";

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

test("basic example", () => {
  assert.equal(slugify("Hello World"), "hello-world");
});

test("separators and punctuation collapse to one dash", () => {
  assert.equal(slugify("Hello,   World!!"), "hello-world");
  assert.equal(slugify("a--b__c"), "a-b-c");
  assert.equal(slugify("Rock & Roll 2024"), "rock-roll-2024");
});

test("leading and trailing separators are removed", () => {
  assert.equal(slugify("  --Hello World--  "), "hello-world");
  assert.equal(slugify("---x---"), "x");
});

test("non-ASCII input never throws and yields only a-z, 0-9 and single dashes", () => {
  for (const input of ["Crème Brûlée", "naïve café", "日本語 text", "Ünï cödé"]) {
    const out = slugify(input);
    assert.equal(typeof out, "string");
    assert.ok(out === "" || SLUG.test(out), `bad slug for ${input}: ${out}`);
  }
});

test("is pure", () => {
  assert.equal(slugify("Same Input"), slugify("Same Input"));
});
