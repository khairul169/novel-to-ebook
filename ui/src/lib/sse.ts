import { ofetch, type FetchOptions } from "ofetch";

export async function streamSSE(
  url: string,
  options: FetchOptions<"json", any> & {
    onMessage: (event: string, data: any) => void;
  },
) {
  const { onMessage, ...opts } = options;

  const stream = await ofetch(url, opts);
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    const parts = buffer.split("\n\n");
    buffer = parts.pop() || "";

    for (const part of parts) {
      const { event, data } = parseSSE(part);
      onMessage(event, data);
    }
  }
}

function parseSSE(chunk: string) {
  const lines = chunk.split("\n");

  let event = "message";
  let data = "";

  for (const line of lines) {
    if (line.startsWith("event:")) {
      event = line.slice(6).trim();
    }

    if (line.startsWith("data:")) {
      data += line.slice(5).trim();
    }
  }

  return { event, data: JSON.parse(data) };
}
