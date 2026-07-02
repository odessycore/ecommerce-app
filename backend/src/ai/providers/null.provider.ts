import { ChatMessage, ChatProvider, EmbeddingProvider } from './types';

// Used when no model is configured. The AI services detect this and fall back to
// deterministic behavior (full-text search + templated answers) so the app still works.
export class NullProvider implements ChatProvider, EmbeddingProvider {
  readonly name = 'none';
  readonly dimension = 0;

  isConfigured(): boolean {
    return false;
  }

  async complete(_messages: ChatMessage[]): Promise<string> {
    return '';
  }

  async *stream(_messages: ChatMessage[]): AsyncIterable<string> {
    // no tokens
  }

  async embed(texts: string[]): Promise<number[][]> {
    return texts.map(() => []);
  }
}
