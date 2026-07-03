import { apiBaseUrl, authHeader } from './api';
import { getCartToken } from './cart-token';

export interface ChatProductCard {
  id: string;
  name: string;
  slug: string;
  brand: string | null;
  priceAmount: number;
  currency: string;
  imageUrl: string | null;
}

export type ChatStreamEvent =
  | { type: 'intent'; intent: string }
  | { type: 'products'; products: ChatProductCard[] }
  | { type: 'token'; value: string }
  | { type: 'done' }
  | { type: 'error'; message: string };

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export async function streamChat(
  payload: { message: string; history: ChatTurn[] },
  onEvent: (event: ChatStreamEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const headers: Record<string, string> = { 'content-type': 'application/json', ...authHeader() };
  const cartToken = getCartToken();
  if (cartToken) headers['x-cart-token'] = cartToken;

  const response = await fetch(`${apiBaseUrl}/ai/chat`, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify(payload),
    signal,
  });
  if (!response.ok) throw new Error(`Assistant request failed (${response.status})`);
  if (!response.body) throw new Error('Streaming not supported');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let boundary: number;
    while ((boundary = buffer.indexOf('\n\n')) !== -1) {
      const frame = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      for (const line of frame.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        try {
          onEvent(JSON.parse(trimmed.slice(5).trim()) as ChatStreamEvent);
        } catch {
          // ignore malformed frame
        }
      }
    }
  }
}
