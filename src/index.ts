import { Hono } from "hono";
import { proxy } from "hono/proxy";
// import { showRoutes } from "hono/dev";
import { createOpenApiDocument } from "hono-zod-openapi";
import { HTTPException } from "hono/http-exception";
import { Scalar } from "@scalar/hono-api-reference";
import { initScheduler } from "./scheduler";
import { runMigration } from "./db/migrate";
import { serveStatic } from "hono/bun";

import projects from "./app/projects/routes";
import library from "./app/library/routes";
import utility from "./app/utility/routes";

const api = new Hono();

api.onError((error, c) => {
  let message = error.message;
  let status = 500;
  let code: string | undefined = undefined;

  if (error instanceof HTTPException) {
    message = error.message;
    status = error.status;
  }

  if ("code" in error) {
    code = error.code as string;
  }

  return c.json({ error: true, message, code }, status as never);
});

// App routes
api.route("/projects", projects);
api.route("/library", library);
api.route("/utility", utility);

// CORS Proxy
api.get("/proxy/*", async (c) => {
  const url = new URL(c.req.url);
  const target = url.pathname.replace("/proxy/", "");
  return proxy(target);
});

// API docs
if (process.env.NODE_ENV !== "production") {
  createOpenApiDocument(
    api,
    {
      info: {
        title: "Storvi API",
        version: "1.0.0",
      },
    },
    { routeName: "openapi.json" },
  );
  api.get(
    "/doc",
    Scalar({
      url: "/openapi.json",
      defaultHttpClient: { targetKey: "node", clientKey: "fetch" },
    }),
  );
  // showRoutes(api);
}

const app = new Hono();
app.route("/api", api);
app.get("*", serveStatic({ root: "./ui/dist" }));

const PORT = process.env.PORT || 3000;
console.log(`Listening on http://localhost:${PORT}`);

initScheduler();
runMigration();

Bun.serve({
  fetch: app.fetch,
  idleTimeout: 255,
  hostname: "0.0.0.0",
  port: PORT,
  development: process.env.NODE_ENV !== "production",
});
