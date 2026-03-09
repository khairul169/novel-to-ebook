import { HTTPException } from "hono/http-exception";
import type { ContentfulStatusCode } from "hono/utils/http-status";

export class HTTPError extends HTTPException {
  code?: string;

  constructor(
    message: string,
    options?: { status?: ContentfulStatusCode; code?: string },
  ) {
    super(options?.status || 400, { message });
    this.code = options?.code;
  }
}
