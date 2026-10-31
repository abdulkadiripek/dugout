import { request } from "node:http";
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

  it("rejects a spoofed Host header over a real socket", async () => {
    const ctx = await setup();
    const server = await startServer({ port: 0, eventsDir: ctx.events, repo: ctx.repo });
    try {
      const result = await new Promise<{ status: number | undefined; body: string }>((resolve, reject) => {
        const req = request(
          { host: "127.0.0.1", port: server.address.port, path: "/api/health", headers: { host: "evil.example" } },
          (res) => {
            let body = "";
            res.on("data", (chunk: Buffer) => { body += chunk.toString(); });
            res.on("end", () => resolve({ status: res.statusCode, body }));
          },
        );
        req.on("error", reject);
        req.end();
      });
      expect(result.status).toBe(403);
      expect(JSON.parse(result.body)).toEqual({ error: "forbidden host" });
    } finally {
      await server.close();
    }
  });
});
