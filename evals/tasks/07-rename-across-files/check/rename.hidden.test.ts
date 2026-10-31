import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as api from "./src/api.ts";
import { describeCount, describeUser } from "./src/profile.ts";

for (const file of ["api.ts", "profile.ts"]) {
  test(`${file} no longer mentions fetchUser`, () => {
    const source = readFileSync(new URL(`./src/${file}`, import.meta.url), "utf8");
    assert.doesNotMatch(source, /\bfetchUser\b/);
  });
}

test("api exports loadUser and keeps unrelated names", async () => {
  const exported = api as Record<string, unknown>;
  assert.equal(typeof exported["loadUser"], "function");
  assert.equal(exported["fetchUser"], undefined);
  assert.equal(typeof exported["fetchUserCount"], "function");
  assert.equal(typeof exported["fetchPosts"], "function");
  assert.deepEqual(await api.loadUser(2), { id: 2, name: "Linus" });
  await assert.rejects(() => api.loadUser(99), /user 99 not found/);
});

test("profile behavior is unchanged", async () => {
  assert.equal(await describeUser(1), "Ada (2 posts)");
  assert.equal(await describeUser(2), "Linus (0 posts)");
  assert.equal(await describeCount(), "2 users");
});
