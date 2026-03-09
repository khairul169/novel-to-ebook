import { Hono } from "hono";
import { proxy } from "hono/proxy";
import extract from "./app/extract/routes";
import { createOpenApiDocument } from "hono-zod-openapi";
import { HTTPException } from "hono/http-exception";

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

// CORS Proxy
app.get("/proxy/*", async (c) => {
  const url = new URL(c.req.url);
  const target = url.pathname.replace("/proxy/", "");
  return proxy(target);
});

// API docs
if (process.env.NODE_ENV !== "production") {
  createOpenApiDocument(app, {
    info: {
      title: "Storvi API",
      version: "1.0.0",
    },
  });
}

Bun.serve({
  fetch: app.fetch,
  idleTimeout: 255,
});
