import { Hono } from "hono";
import { proxy } from "hono/proxy";
import { createOpenApiDocument } from "hono-zod-openapi";
import { HTTPException } from "hono/http-exception";
import { Scalar } from "@scalar/hono-api-reference";

import extract from "./app/extract/routes";
import library from "./app/library/routes";
import { initScheduler } from "./scheduler";

const app = new Hono();

app.onError((error, c) => {
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
app.route("/extract", extract);
app.route("/library", library);

// CORS Proxy
app.get("/proxy/*", async (c) => {
  const url = new URL(c.req.url);
  const target = url.pathname.replace("/proxy/", "");
  return proxy(target);
});

// API docs
if (process.env.NODE_ENV !== "production") {
  createOpenApiDocument(
    app,
    {
      info: {
        title: "Storvi API",
        version: "1.0.0",
      },
    },
    { routeName: "openapi.json" },
  );
  app.get(
    "/doc",
    Scalar({
      url: "/openapi.json",
      defaultHttpClient: { targetKey: "node", clientKey: "fetch" },
    }),
  );
}

const PORT = process.env.PORT || 3000;
console.log(`Listening on http://localhost:${PORT}`);

initScheduler();

Bun.serve({
  fetch: app.fetch,
  idleTimeout: 255,
  development: process.env.NODE_ENV !== "production",
});
