// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { navigate, parseHash, useRoute } from "./router.js";

afterEach(() => {
  cleanup();
  window.location.hash = "";
});

describe("parseHash", () => {
  it("parses known routes", () => {
    expect(parseHash("")).toEqual({ name: "list" });
    expect(parseHash("#/")).toEqual({ name: "list" });
    expect(parseHash("#/?status=failed")).toEqual({ name: "list" });
    expect(parseHash("#/scorecard")).toEqual({ name: "scorecard" });
    expect(parseHash("#/tasks/abc_1-2")).toEqual({ name: "task", id: "abc_1-2" });
  });

  it("returns not-found for anything else", () => {
    expect(parseHash("#/nope")).toEqual({ name: "not-found", hash: "#/nope" });
    expect(parseHash("#/tasks/")).toMatchObject({ name: "not-found" });
    expect(parseHash("#/tasks/../x")).toMatchObject({ name: "not-found" });
    expect(parseHash("#/tasks/a/b")).toMatchObject({ name: "not-found" });
  });
});

describe("useRoute", () => {
  it("follows hashchange", async () => {
    const { result } = renderHook(() => useRoute());
    expect(result.current).toEqual({ name: "list" });
    await act(async () => {
      navigate("#/tasks/x1");
      await new Promise((r) => setTimeout(r, 10));
    });
    expect(result.current).toEqual({ name: "task", id: "x1" });
  });
});
