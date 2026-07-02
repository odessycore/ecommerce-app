import { Inject, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EMBEDDING_PROVIDER, EmbeddingProvider } from './providers/types';

type ProductForEmbedding = Prisma.ProductGetPayload<{ include: { category: true } }>;

function buildProductText(product: ProductForEmbedding): string {
  const attributes = Object.entries((product.attributes as Record<string, unknown>) ?? {})
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(', ');
  return [
    product.name,
    product.brand,
    product.category?.name,
    product.description,
    attributes,
  ]
    .filter(Boolean)
    .join('. ');
}

export function toVectorLiteral(vector: number[]): string {
  return `[${vector.join(',')}]`;
}

@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(EMBEDDING_PROVIDER) private readonly provider: EmbeddingProvider,
  ) {}

  isEnabled(): boolean {
    return this.provider.isConfigured();
  }

  async embedQuery(text: string): Promise<number[] | null> {
    if (!this.isEnabled() || !text.trim()) return null;
    try {
      const [vector] = await this.provider.embed([text]);
      return vector?.length ? vector : null;
    } catch (error) {
      this.logger.warn(`Query embedding failed: ${(error as Error).message}`);
      return null;
    }
  }

  async embedProduct(productId: string): Promise<void> {
    if (!this.isEnabled()) return;
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: { category: true },
    });
    if (!product) return;

    try {
      const [vector] = await this.provider.embed([buildProductText(product)]);
      if (!vector?.length) return;
      await this.prisma.$executeRaw(Prisma.sql`
        UPDATE "products"
        SET "embedding" = ${toVectorLiteral(vector)}::vector,
            "embeddingModel" = ${this.provider.name},
            "indexedAt" = now()
        WHERE "id" = ${productId}::uuid`);
    } catch (error) {
      this.logger.warn(`Product embedding failed (${productId}): ${(error as Error).message}`);
    }
  }
}
