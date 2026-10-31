import { serve } from "@hono/node-server";
import { createApp } from "./app.js";

const HOST = "127.0.0.1";

export interface ServerOptions {
  port: number;
  eventsDir: string;
  repo: string;
}

export interface RunningServer {
  close(): Promise<void>;
  address: { host: string; port: number };
}

export function startServer({ port, eventsDir, repo }: ServerOptions): Promise<RunningServer> {
  const app = createApp({ eventsDir, repo });
  return new Promise((resolve, reject) => {
    const server = serve({ fetch: app.fetch, port, hostname: HOST }, (info) => {
      server.off("error", reject);
      resolve({
        address: { host: HOST, port: info.port },
        close: () => new Promise<void>((done, fail) => {
          server.close((error) => (error ? fail(error) : done()));
          if ("closeAllConnections" in server) server.closeAllConnections();
        }),
      });
    });
    server.once("error", reject);
  });
}
