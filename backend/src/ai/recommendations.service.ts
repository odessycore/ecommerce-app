import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EmbeddingService } from './embedding.service';

const CARD_INCLUDE = {
  category: { select: { id: true, name: true, slug: true } },
  images: { orderBy: { position: 'asc' }, take: 1 },
  variants: { orderBy: { priceAmount: 'asc' } },
} satisfies Prisma.ProductInclude;

@Injectable()
export class RecommendationsService {
  private readonly logger = new Logger(RecommendationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly embeddings: EmbeddingService,
  ) {}

  // "You might also like": embedding-similar products, re-ranked toward the customer's
  // purchase history. Falls back to same-category products when embeddings are unavailable.
  async forProduct(productId: string, userId: string | undefined, limit: number) {
    let ids: string[] | null = null;
    if (this.embeddings.isEnabled()) {
      try {
        ids = await this.embeddingRecommendations(productId, userId, limit);
      } catch (error) {
        this.logger.warn(`Embedding recommendations failed: ${(error as Error).message}`);
      }
    }

    const finalIds = ids ?? (await this.categoryFallback(productId, limit));
    return this.hydrate(finalIds);
  }

  private async embeddingRecommendations(
    productId: string,
    userId: string | undefined,
    limit: number,
  ): Promise<string[] | null> {
    const [current] = await this.prisma.$queryRaw<{ emb: string | null }[]>(Prisma.sql`
      SELECT "embedding"::text AS emb FROM "products" WHERE "id" = ${productId}::uuid`);
    if (!current?.emb) return null;

    const purchasedIds = userId ? await this.purchasedProductIds(userId, productId) : [];
    const exclusions = [productId, ...purchasedIds].map((id) => Prisma.sql`${id}::uuid`);
    const notIn = Prisma.sql`AND p."id" NOT IN (${Prisma.join(exclusions)})`;

    let scoreExpr = Prisma.sql`(1 - (p."embedding" <=> ${current.emb}::vector))`;
    if (purchasedIds.length > 0) {
      const purchased = purchasedIds.map((id) => Prisma.sql`${id}::uuid`);
      const centroid = Prisma.sql`(SELECT avg("embedding") FROM "products"
        WHERE "id" IN (${Prisma.join(purchased)}) AND "embedding" IS NOT NULL)`;
      scoreExpr = Prisma.sql`(0.6 * (1 - (p."embedding" <=> ${current.emb}::vector))
        + 0.4 * (1 - (p."embedding" <=> ${centroid})))`;
    }

    const rows = await this.prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT p."id", ${scoreExpr} AS score
      FROM "products" p
      WHERE p."embedding" IS NOT NULL AND p."status" = 'ACTIVE' AND p."deletedAt" IS NULL
        ${notIn}
      ORDER BY score DESC
      LIMIT ${limit}`);
    return rows.map((r) => r.id);
  }

  private async purchasedProductIds(userId: string, exclude: string): Promise<string[]> {
    const items = await this.prisma.orderItem.findMany({
      where: {
        order: { customerId: userId, paymentStatus: 'SUCCEEDED' },
        variantId: { not: null },
      },
      select: { variant: { select: { productId: true } } },
    });
    const ids = new Set<string>();
    for (const item of items) {
      const id = item.variant?.productId;
      if (id && id !== exclude) ids.add(id);
    }
    return [...ids];
  }

  // Broadens to the whole department (sibling categories under the same parent), then tops
  // up with other active products so there's always something to show.
  private async categoryFallback(productId: string, limit: number): Promise<string[]> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { category: { select: { id: true, parentId: true } } },
    });

    const ids: string[] = [];
    const department = product?.category?.parentId ?? product?.category?.id;
    if (department) {
      const categories = await this.prisma.category.findMany({
        where: { OR: [{ id: department }, { parentId: department }] },
        select: { id: true },
      });
      const siblings = await this.prisma.product.findMany({
        where: {
          id: { not: productId },
          status: 'ACTIVE',
          deletedAt: null,
          categoryId: { in: categories.map((c) => c.id) },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: { id: true },
      });
      ids.push(...siblings.map((p) => p.id));
    }

    if (ids.length < limit) {
      const fill = await this.prisma.product.findMany({
        where: { id: { notIn: [productId, ...ids] }, status: 'ACTIVE', deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: limit - ids.length,
        select: { id: true },
      });
      ids.push(...fill.map((p) => p.id));
    }
    return ids;
  }

  private async hydrate(ids: string[]) {
    if (ids.length === 0) return [];
    const products = await this.prisma.product.findMany({
      where: { id: { in: ids } },
      include: CARD_INCLUDE,
    });
    return ids
      .map((id) => products.find((product) => product.id === id))
      .filter((product): product is (typeof products)[number] => Boolean(product));
  }
}
