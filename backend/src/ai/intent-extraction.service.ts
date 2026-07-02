import { Inject, Injectable, Logger } from '@nestjs/common';
import { CHAT_PROVIDER, ChatProvider } from './providers/types';
import { SearchFacets } from './semantic-search.service';

export type ChatIntent = 'product_search' | 'order_status' | 'general';

export interface ExtractedIntent {
  intent: ChatIntent;
  query: string;
  facets: SearchFacets;
  orderRef: string | null;
}

const SYSTEM_PROMPT = `You parse shopping-assistant messages. Respond with ONLY a JSON object, no prose:
{
  "intent": "product_search" | "order_status" | "general",
  "query": "concise search phrase capturing what the user wants",
  "facets": {
    "category": string | null,
    "color": string | null,
    "style": string | null,
    "useCase": string | null,
    "priceMin": number | null,
    "priceMax": number | null
  },
  "orderRef": string | null
}
priceMin/priceMax are in dollars. Use null for anything not stated. "orderRef" is an order number if the user references one.`;

@Injectable()
export class IntentExtractionService {
  private readonly logger = new Logger(IntentExtractionService.name);

  constructor(@Inject(CHAT_PROVIDER) private readonly chat: ChatProvider) {}

  async extract(message: string): Promise<ExtractedIntent> {
    if (this.chat.isConfigured()) {
      try {
        const raw = await this.chat.complete(
          [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: message },
          ],
          { json: true, temperature: 0 },
        );
        const parsed = this.parseJson(raw);
        if (parsed) return this.normalize(parsed, message);
      } catch (error) {
        this.logger.warn(`Intent extraction failed: ${(error as Error).message}`);
      }
    }
    return this.heuristic(message);
  }

  private parseJson(raw: string): Record<string, unknown> | null {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start === -1 || end <= start) return null;
    try {
      return JSON.parse(raw.slice(start, end + 1));
    } catch {
      return null;
    }
  }

  private normalize(parsed: Record<string, unknown>, message: string): ExtractedIntent {
    const facets = (parsed.facets as Record<string, unknown>) ?? {};
    const intent = parsed.intent as ChatIntent;
    return {
      intent: ['product_search', 'order_status', 'general'].includes(intent)
        ? intent
        : 'product_search',
      query: typeof parsed.query === 'string' && parsed.query ? parsed.query : message,
      facets: {
        category: this.str(facets.category),
        color: this.str(facets.color),
        style: this.str(facets.style),
        useCase: this.str(facets.useCase),
        priceMin: this.num(facets.priceMin),
        priceMax: this.num(facets.priceMax),
      },
      orderRef: this.str(parsed.orderRef),
    };
  }

  private heuristic(message: string): ExtractedIntent {
    const lower = message.toLowerCase();
    const orderRef = message.match(/ORD-[0-9A-Z]+/i)?.[0] ?? null;
    const looksLikeOrder =
      orderRef !== null || /\b(order|tracking|where('s| is)|status|delivery|shipped)\b/.test(lower);
    return {
      intent: looksLikeOrder ? 'order_status' : 'product_search',
      query: message,
      facets: {},
      orderRef,
    };
  }

  private str(value: unknown): string | null {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  }

  private num(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  }
}
