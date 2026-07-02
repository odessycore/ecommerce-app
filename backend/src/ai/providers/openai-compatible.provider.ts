import { ChatMessage, ChatOptions, ChatProvider, EmbeddingProvider } from './types';
import { readSseData } from './sse';

interface OpenAiCompatibleConfig {
  baseUrl: string;
  apiKey: string;
  chatModel: string;
  embeddingModel: string;
  dimension: number;
}

// Works with any OpenAI-compatible server: vLLM, TGI (/v1), Ollama, TEI, or the HF router.
export class OpenAiCompatibleProvider implements ChatProvider, EmbeddingProvider {
  readonly name = 'openai-compatible';

  constructor(private readonly config: OpenAiCompatibleConfig) {}

  get dimension(): number {
    return this.config.dimension;
  }

  isConfigured(): boolean {
    return Boolean(this.config.baseUrl);
  }

  private headers(): Record<string, string> {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (this.config.apiKey) headers.authorization = `Bearer ${this.config.apiKey}`;
    return headers;
  }

  async complete(messages: ChatMessage[], options: ChatOptions = {}): Promise<string> {
    const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        model: this.config.chatModel,
        messages,
        temperature: options.temperature ?? 0.2,
        max_tokens: options.maxTokens ?? 512,
        response_format: options.json ? { type: 'json_object' } : undefined,
        stream: false,
      }),
    });
    if (!response.ok) throw new Error(`Chat completion failed: ${response.status}`);
    const data = await response.json();
    return data.choices?.[0]?.message?.content ?? '';
  }

  async *stream(messages: ChatMessage[], options: ChatOptions = {}): AsyncIterable<string> {
    const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        model: this.config.chatModel,
        messages,
        temperature: options.temperature ?? 0.5,
        max_tokens: options.maxTokens ?? 512,
        stream: true,
      }),
    });
    if (!response.ok) throw new Error(`Chat stream failed: ${response.status}`);

    for await (const data of readSseData(response)) {
      if (data === '[DONE]') return;
      try {
        const token = JSON.parse(data).choices?.[0]?.delta?.content;
        if (token) yield token;
      } catch {
        // ignore keep-alive / non-JSON frames
      }
    }
  }

  async embed(texts: string[]): Promise<number[][]> {
    const response = await fetch(`${this.config.baseUrl}/embeddings`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ model: this.config.embeddingModel, input: texts }),
    });
    if (!response.ok) throw new Error(`Embedding failed: ${response.status}`);
    const data = await response.json();
    return (data.data as { index: number; embedding: number[] }[])
      .slice()
      .sort((a, b) => a.index - b.index)
      .map((item) => item.embedding);
  }
}
