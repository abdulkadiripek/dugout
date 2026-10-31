import { describe, expect, it } from "vitest";
import { startServer } from "./server.js";
import { setup } from "./test-helpers.js";

describe("startServer", () => {
  it("binds 127.0.0.1, serves health and closes", async () => {
    const ctx = await setup();
    const server = await startServer({ port: 0, eventsDir: ctx.events, repo: ctx.repo });
    try {
      expect(server.address.host).toBe("127.0.0.1");
      expect(server.address.port).toBeGreaterThan(0);
      const response = await fetch(`http://127.0.0.1:${server.address.port}/api/health`);
      expect(await response.json()).toEqual({ ok: true });
      expect(response.headers.get("access-control-allow-origin")).toBeNull();
    } finally {
      await server.close();
    }
    await expect(fetch(`http://127.0.0.1:${server.address.port}/api/health`)).rejects.toThrow();
  });
});
