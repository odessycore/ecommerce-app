import { Inject, Injectable, Logger } from '@nestjs/common';
import { OrderStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CHAT_PROVIDER, ChatMessage, ChatProvider } from './providers/types';
import { IntentExtractionService } from './intent-extraction.service';
import { SemanticSearchService } from './semantic-search.service';

interface ChatActor {
  id: string;
  role: string;
}

export interface ChatRequest {
  message: string;
  history?: ChatMessage[];
  actor?: ChatActor;
}

interface ProductCard {
  id: string;
  name: string;
  slug: string;
  brand: string | null;
  priceAmount: number;
  currency: string;
  imageUrl: string | null;
}

export type ChatEvent =
  | { type: 'intent'; intent: string }
  | { type: 'products'; products: ProductCard[] }
  | { type: 'token'; value: string }
  | { type: 'done' }
  | { type: 'error'; message: string };

const STORE_PERSONA =
  'You are the shopping assistant for ACME, a premium black-themed store. Be concise, warm, and helpful.';

function money(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(
    amount / 100,
  );
}

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly extraction: IntentExtractionService,
    private readonly search: SemanticSearchService,
    @Inject(CHAT_PROVIDER) private readonly chat: ChatProvider,
  ) {}

  async *run(request: ChatRequest): AsyncGenerator<ChatEvent> {
    try {
      const intent = await this.extraction.extract(request.message);
      yield { type: 'intent', intent: intent.intent };

      if (intent.intent === 'order_status') {
        yield* this.handleOrderStatus(request, intent.orderRef);
        return;
      }
      if (intent.intent === 'product_search') {
        yield* this.handleProductSearch(request, intent.query, intent.facets);
        return;
      }
      yield* this.handleGeneral(request);
    } catch (error) {
      this.logger.error('Chat run failed', error as Error);
      yield { type: 'error', message: 'The assistant is temporarily unavailable.' };
    } finally {
      yield { type: 'done' };
    }
  }

  private async *handleProductSearch(
    request: ChatRequest,
    query: string,
    facets: Parameters<SemanticSearchService['search']>[1],
  ): AsyncGenerator<ChatEvent> {
    const products = await this.search.search(query, facets, 8);
    const cards = products.map((product) => this.toCard(product));
    yield { type: 'products', products: cards };

    if (cards.length === 0) {
      yield {
        type: 'token',
        value: "I couldn't find anything matching that. Try a different style, colour, or budget.",
      };
      return;
    }

    const context = cards
      .map((c) => `- ${c.name}${c.brand ? ` by ${c.brand}` : ''} — ${money(c.priceAmount, c.currency)}`)
      .join('\n');
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `${STORE_PERSONA} Recommend ONLY from the products below. Mention 2-3 by name and why they fit. Never invent products or prices.\n\nProducts:\n${context}`,
      },
      ...(request.history ?? []),
      { role: 'user', content: request.message },
    ];
    yield* this.answer(messages, () => this.fallbackProductAnswer(cards));
  }

  private async *handleOrderStatus(
    request: ChatRequest,
    orderRef: string | null,
  ): AsyncGenerator<ChatEvent> {
    if (!request.actor) {
      yield { type: 'token', value: 'Please sign in to your account so I can look up your orders.' };
      return;
    }

    const where: Prisma.OrderWhereInput = { customerId: request.actor.id };
    if (orderRef) where.orderNumber = { equals: orderRef, mode: 'insensitive' };
    const orders = await this.prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: orderRef ? 1 : 3,
      select: {
        orderNumber: true,
        status: true,
        fulfillmentStatus: true,
        totalAmount: true,
        currency: true,
        createdAt: true,
      },
    });

    if (orders.length === 0) {
      yield { type: 'token', value: "I couldn't find any orders on your account for that." };
      return;
    }

    const context = orders
      .map(
        (o) =>
          `${o.orderNumber}: status ${o.status}, fulfillment ${o.fulfillmentStatus}, total ${money(o.totalAmount, o.currency)}`,
      )
      .join('\n');
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `${STORE_PERSONA} Answer about the customer's orders using ONLY this data:\n${context}`,
      },
      { role: 'user', content: request.message },
    ];
    yield* this.answer(messages, () => this.fallbackOrderAnswer(orders));
  }

  private async *handleGeneral(request: ChatRequest): AsyncGenerator<ChatEvent> {
    const messages: ChatMessage[] = [
      { role: 'system', content: `${STORE_PERSONA} If asked for something off-topic, steer back to shopping help.` },
      ...(request.history ?? []),
      { role: 'user', content: request.message },
    ];
    yield* this.answer(
      messages,
      () => 'I can help you find products or check your order status — what are you looking for?',
    );
  }

  private async *answer(
    messages: ChatMessage[],
    fallback: () => string,
  ): AsyncGenerator<ChatEvent> {
    if (!this.chat.isConfigured()) {
      yield { type: 'token', value: fallback() };
      return;
    }
    try {
      let streamed = false;
      for await (const token of this.chat.stream(messages, { temperature: 0.4 })) {
        streamed = true;
        yield { type: 'token', value: token };
      }
      if (!streamed) yield { type: 'token', value: fallback() };
    } catch (error) {
      this.logger.warn(`Generation failed, using fallback: ${(error as Error).message}`);
      yield { type: 'token', value: fallback() };
    }
  }

  private fallbackProductAnswer(cards: ProductCard[]): string {
    const top = cards
      .slice(0, 3)
      .map((c) => `${c.name} (${money(c.priceAmount, c.currency)})`)
      .join(', ');
    return `Here are a few options you might like: ${top}.`;
  }

  private fallbackOrderAnswer(
    orders: { orderNumber: string; status: OrderStatus; totalAmount: number; currency: string }[],
  ): string {
    return orders
      .map((o) => `${o.orderNumber} is ${o.status.toLowerCase()} (${money(o.totalAmount, o.currency)}).`)
      .join(' ');
  }

  private toCard(product: {
    id: string;
    name: string;
    slug: string;
    brand: string | null;
    variants: { priceAmount: number; currency: string }[];
    images: { url: string }[];
  }): ProductCard {
    const cheapest = product.variants[0];
    return {
      id: product.id,
      name: product.name,
      slug: product.slug,
      brand: product.brand,
      priceAmount: cheapest?.priceAmount ?? 0,
      currency: cheapest?.currency ?? 'usd',
      imageUrl: product.images[0]?.url ?? null,
    };
  }
}
