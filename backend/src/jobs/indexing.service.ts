import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EmbeddingService } from '../ai/embedding.service';

@Injectable()
export class IndexingService {
  private readonly logger = new Logger(IndexingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly embeddings: EmbeddingService,
  ) {}

  // Recomputes the weighted full-text vector for one product (name > brand > description)
  // and regenerates its semantic embedding when an embedding model is configured.
  async reindexProduct(productId: string): Promise<void> {
    await this.updateSearchVector(Prisma.sql`"id" = ${productId}::uuid`);
    await this.embeddings.embedProduct(productId);
  }

  async reindexAll(): Promise<number> {
    const result = await this.updateSearchVector(Prisma.sql`"deletedAt" IS NULL`);
    if (this.embeddings.isEnabled()) {
      const products = await this.prisma.product.findMany({
        where: { deletedAt: null },
        select: { id: true },
      });
      for (const product of products) {
        await this.embeddings.embedProduct(product.id);
      }
    }
    this.logger.log(`Reindexed ${result} products`);
    return result;
  }

  private updateSearchVector(where: Prisma.Sql): Promise<number> {
    return this.prisma.$executeRaw(Prisma.sql`
      UPDATE "products" SET
        "searchVector" =
          setweight(to_tsvector('english', coalesce("name", '')), 'A') ||
          setweight(to_tsvector('english', coalesce("brand", '')), 'B') ||
          setweight(to_tsvector('english', coalesce("description", '')), 'C'),
        "indexedAt" = now()
      WHERE ${where}`);
  }
}
