import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EmbeddingService, toVectorLiteral } from './embedding.service';

export interface SearchFacets {
  category?: string | null;
  priceMin?: number | null;
  priceMax?: number | null;
  color?: string | null;
  useCase?: string | null;
  style?: string | null;
  keywords?: string | null;
}

const PRODUCT_CARD_INCLUDE = {
  category: { select: { id: true, name: true, slug: true } },
  images: { orderBy: { position: 'asc' }, take: 1 },
  variants: { orderBy: { priceAmount: 'asc' } },
} satisfies Prisma.ProductInclude;

@Injectable()
export class SemanticSearchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly embeddings: EmbeddingService,
  ) {}

  async search(query: string, facets: SearchFacets, limit = 8) {
    const filters = this.buildFilters(facets);
    const ranked = this.embeddings.isEnabled()
      ? await this.vectorSearch(query, facets, filters, limit)
      : null;

    const ids = ranked ?? (await this.fullTextSearch(query, filters, limit));
    return this.hydrate(ids);
  }

  private async vectorSearch(
    query: string,
    facets: SearchFacets,
    filters: Prisma.Sql,
    limit: number,
  ): Promise<string[] | null> {
    const text = [query, facets.color, facets.style, facets.useCase]
      .filter(Boolean)
      .join(' ');
    const vector = await this.embeddings.embedQuery(text);
    if (!vector) return null;

    const literal = toVectorLiteral(vector);
    const rows = await this.prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT "id" FROM "products" p
      WHERE p."embedding" IS NOT NULL
        AND p."status" = 'ACTIVE' AND p."deletedAt" IS NULL
        ${filters}
      ORDER BY p."embedding" <=> ${literal}::vector
      LIMIT ${limit}`);
    return rows.length ? rows.map((r) => r.id) : null;
  }

  private async fullTextSearch(
    query: string,
    filters: Prisma.Sql,
    limit: number,
  ): Promise<string[]> {
    // OR-match the salient words so a natural-language sentence still retrieves results
    // (websearch_to_tsquery's implicit AND would match nothing for a long query).
    const words = (query.toLowerCase().match(/[a-z0-9]{2,}/g) ?? []).slice(0, 8);
    if (words.length > 0) {
      const tsquery = Prisma.sql`to_tsquery('english', ${words.join(' | ')})`;
      const rows = await this.prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
        SELECT "id" FROM "products" p
        WHERE p."status" = 'ACTIVE' AND p."deletedAt" IS NULL
          AND p."searchVector" @@ ${tsquery} ${filters}
        ORDER BY ts_rank(p."searchVector", ${tsquery}) DESC
        LIMIT ${limit}`);
      if (rows.length > 0) return rows.map((r) => r.id);
    }
    // No salient words (or all stopwords / no matches) — return recent products in scope.
    const recent = await this.prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT "id" FROM "products" p
      WHERE p."status" = 'ACTIVE' AND p."deletedAt" IS NULL ${filters}
      ORDER BY p."createdAt" DESC LIMIT ${limit}`);
    return recent.map((r) => r.id);
  }

  private buildFilters(facets: SearchFacets): Prisma.Sql {
    const conditions: Prisma.Sql[] = [];

    if (facets.category) {
      const pattern = `%${facets.category}%`;
      conditions.push(Prisma.sql`AND p."categoryId" IN (
        SELECT c."id" FROM "categories" c
        WHERE c."name" ILIKE ${pattern}
          OR c."parentId" IN (SELECT "id" FROM "categories" WHERE "name" ILIKE ${pattern}))`);
    }
    if (facets.priceMin != null) {
      conditions.push(Prisma.sql`AND EXISTS (SELECT 1 FROM "product_variants" v
        WHERE v."productId" = p."id" AND v."priceAmount" >= ${Math.round(facets.priceMin * 100)})`);
    }
    if (facets.priceMax != null) {
      conditions.push(Prisma.sql`AND EXISTS (SELECT 1 FROM "product_variants" v
        WHERE v."productId" = p."id" AND v."priceAmount" <= ${Math.round(facets.priceMax * 100)})`);
    }
    return conditions.length ? Prisma.join(conditions, ' ') : Prisma.empty;
  }

  private async hydrate(ids: string[]) {
    if (ids.length === 0) return [];
    const products = await this.prisma.product.findMany({
      where: { id: { in: ids } },
      include: PRODUCT_CARD_INCLUDE,
    });
    return ids
      .map((id) => products.find((product) => product.id === id))
      .filter((product): product is (typeof products)[number] => Boolean(product));
  }
}
