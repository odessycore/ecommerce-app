import { ChatMessage, ChatOptions, ChatProvider, EmbeddingProvider } from './types';
import { readSseData } from './sse';

interface HuggingFaceConfig {
  apiKey: string;
  baseUrl: string;
  chatModel: string;
  embeddingModel: string;
  dimension: number;
}

function renderPrompt(messages: ChatMessage[]): string {
  const system = messages
    .filter((m) => m.role === 'system')
    .map((m) => m.content)
    .join('\n');
  const turns = messages
    .filter((m) => m.role !== 'system')
    .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
    .join('\n');
  return `${system}\n\n${turns}\nAssistant:`.trim();
}

// Native Hugging Face Inference API: text-generation (TGI) + feature-extraction (TEI).
// For OpenAI-style chat-completions serving (incl. the HF router) use the 'openai' provider.
export class HuggingFaceProvider implements ChatProvider, EmbeddingProvider {
  readonly name = 'huggingface';

  constructor(private readonly config: HuggingFaceConfig) {}

  get dimension(): number {
    return this.config.dimension;
  }

  isConfigured(): boolean {
    return Boolean(this.config.apiKey);
  }

  private headers(): Record<string, string> {
    return {
      'content-type': 'application/json',
      authorization: `Bearer ${this.config.apiKey}`,
    };
  }

  async complete(messages: ChatMessage[], options: ChatOptions = {}): Promise<string> {
    const response = await fetch(`${this.config.baseUrl}/models/${this.config.chatModel}`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        inputs: renderPrompt(messages),
        parameters: {
          max_new_tokens: options.maxTokens ?? 512,
          temperature: Math.max(options.temperature ?? 0.2, 0.01),
          return_full_text: false,
        },
        options: { wait_for_model: true },
      }),
    });
    if (!response.ok) throw new Error(`HF generation failed: ${response.status}`);
    const data = await response.json();
    return Array.isArray(data) ? (data[0]?.generated_text ?? '') : (data.generated_text ?? '');
  }

  async *stream(messages: ChatMessage[], options: ChatOptions = {}): AsyncIterable<string> {
    const response = await fetch(`${this.config.baseUrl}/models/${this.config.chatModel}`, {
      method: 'POST',
      headers: { ...this.headers(), accept: 'text/event-stream' },
      body: JSON.stringify({
        inputs: renderPrompt(messages),
        parameters: {
          max_new_tokens: options.maxTokens ?? 512,
          temperature: options.temperature ?? 0.5,
          return_full_text: false,
        },
        stream: true,
      }),
    });
    if (!response.ok) throw new Error(`HF stream failed: ${response.status}`);

    for await (const data of readSseData(response)) {
      try {
        const parsed = JSON.parse(data);
        const token = parsed.token?.text;
        if (token && !parsed.token?.special) yield token;
      } catch {
        // ignore non-JSON frames
      }
    }
  }

  async embed(texts: string[]): Promise<number[][]> {
    // Explicit feature-extraction task so sentence-transformers models return sentence
    // embeddings (works for both api-inference.huggingface.co and the HF router).
    const url = `${this.config.baseUrl}/models/${this.config.embeddingModel}/pipeline/feature-extraction`;
    const response = await fetch(url, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ inputs: texts, options: { wait_for_model: true } }),
    });
    if (!response.ok) throw new Error(`HF embedding failed: ${response.status}`);
    const data = await response.json();
    const rows: number[][] = Array.isArray(data[0]) ? data : [data];
    return rows;
  }
}
