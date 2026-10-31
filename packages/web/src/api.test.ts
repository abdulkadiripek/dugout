import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, getDiff, getScorecard, getTask, getTasks } from "./api.js";

function stub(status: number, body: unknown) {
  const fn = vi.fn(async () => new Response(typeof body === "string" ? body : JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => vi.unstubAllGlobals());

describe("api client", () => {
  it("getTasks builds the query and unwraps tasks", async () => {
    const fn = stub(200, { tasks: [{ taskId: "a" }] });
    expect(await getTasks({ limit: 5, status: "failed" })).toEqual([{ taskId: "a" }]);
    expect(fn).toHaveBeenCalledWith("/api/tasks?limit=5&status=failed");
    await getTasks();
    expect(fn).toHaveBeenLastCalledWith("/api/tasks");
  });

  it("getTask, getDiff and getScorecard hit their routes", async () => {
    const fn = stub(200, { ok: 1 });
    await getTask("t-1");
    await getDiff("t-1");
    await getScorecard();
    expect(fn.mock.calls.map((c) => (c as unknown[])[0])).toEqual([
      "/api/tasks/t-1", "/api/tasks/t-1/diff", "/api/scorecard",
    ]);
  });

  it("maps 404 to ApiError with the server message", async () => {
    stub(404, { error: "task not found" });
    const err = await getTask("nope").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 404, message: "task not found" });
  });

  it("maps 400 and non-JSON error bodies", async () => {
    stub(400, { error: "invalid id" });
    await expect(getDiff("..")).rejects.toMatchObject({ status: 400, message: "invalid id" });
    stub(502, "<html>bad gateway</html>");
    await expect(getScorecard()).rejects.toMatchObject({ status: 502 });
  });
});
