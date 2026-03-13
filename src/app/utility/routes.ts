import { Hono } from "hono";
import { openApi } from "hono-zod-openapi";
import z from "zod";
import { FontDecryptor } from "../../lib/font-decryptor";
import { decryptTextFromFont } from "./utils";

const router = new Hono();

router.post(
  "/font-decrypt",
  openApi({
    tags: ["Utility"],
    summary: "Decrypt font map",
    request: {
      json: z.object({
        decryptMap: z.string().nullish(),
        fontUrl: z.url().nullish(),
        text: z.string().array().nullish(),
      }),
    },
    responses: {
      200: z.object({ map: z.string(), result: z.string().array().nullish() }),
    },
  }),
  async (c) => {
    const { decryptMap, fontUrl, text } = c.req.valid("json");
    const { map, result } = await decryptTextFromFont(text || [], {
      decryptMap,
      fontUrl,
    });
    return c.var.res({ map: JSON.stringify(map), result });
  },
);

export default router;
