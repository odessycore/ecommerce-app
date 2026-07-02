export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
  json?: boolean;
}

export interface ChatProvider {
  readonly name: string;
  isConfigured(): boolean;
  complete(messages: ChatMessage[], options?: ChatOptions): Promise<string>;
  stream(messages: ChatMessage[], options?: ChatOptions): AsyncIterable<string>;
}

export interface EmbeddingProvider {
  readonly name: string;
  readonly dimension: number;
  isConfigured(): boolean;
  embed(texts: string[]): Promise<number[][]>;
}

export const CHAT_PROVIDER = Symbol('CHAT_PROVIDER');
export const EMBEDDING_PROVIDER = Symbol('EMBEDDING_PROVIDER');
