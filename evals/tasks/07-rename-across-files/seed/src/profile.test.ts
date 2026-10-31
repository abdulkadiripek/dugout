import { test } from "node:test";
import assert from "node:assert/strict";
import { describeCount, describeUser } from "./profile.ts";

test("describes a user", async () => {
  assert.equal(await describeUser(1), "Ada (2 posts)");
  assert.equal(await describeUser(2), "Linus (0 posts)");
});

test("describes the user count", async () => {
  assert.equal(await describeCount(), "2 users");
});
