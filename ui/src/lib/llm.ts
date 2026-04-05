type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type OllamaChatResponse = {
  model: string;
  created_at: string;
  message: ChatMessage;
  done: boolean;
};

export async function llmChat(
  model: string,
  messages: ChatMessage[],
  onChunk?: ((chunk: string) => void) | null,
  controller?: AbortController,
): Promise<string> {
  const isStream = onChunk != null;
  const response = await fetch("http://localhost:11434/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      stream: isStream,
    }),
    signal: controller?.signal,
  });

  if (!response.ok) {
    throw new Error(`Ollama API error: ${response.statusText}`);
  }

  if (isStream) {
    if (!response.body) {
      throw new Error("No response body");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split("\n").filter(Boolean);

      for (const line of lines) {
        const parsed = JSON.parse(line);
        const content = parsed.message?.content;

        if (content) {
          buffer += content;
          onChunk(content);
        }
      }
    }

    return buffer;
  }

  const data: OllamaChatResponse = await response.json();
  return data.message.content;
}
