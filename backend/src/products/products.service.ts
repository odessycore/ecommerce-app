import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ProductStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { paginate, Paginated } from '../common/dto/pagination.dto';
import { JobsService } from '../jobs/jobs.service';
import { toUniqueSlug } from '../common/utils/slug';
import {
  CreateProductDto,
  ProductQueryDto,
  ProductVariantDto,
  UpdateProductDto,
} from './dto/product.dto';

const PRODUCT_INCLUDE = {
  category: { select: { id: true, name: true, slug: true } },
  images: { orderBy: { position: 'asc' } },
  variants: { orderBy: { createdAt: 'asc' } },
} satisfies Prisma.ProductInclude;

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jobs: JobsService,
  ) {}

  async create(dto: CreateProductDto) {
    const product = await this.prisma.product.create({
      data: {
        name: dto.name,
        slug: toUniqueSlug(dto.name),
        description: dto.description,
        status: dto.status ?? ProductStatus.DRAFT,
        categoryId: dto.categoryId,
        brand: dto.brand,
        attributes: (dto.attributes ?? {}) as Prisma.InputJsonValue,
        publishedAt: dto.status === ProductStatus.ACTIVE ? new Date() : null,
        variants: { create: dto.variants.map((v) => this.toVariantCreate(v)) },
        images: dto.images?.length
          ? { create: dto.images.map((image, index) => ({ ...image, position: image.position ?? index })) }
          : undefined,
      },
      include: PRODUCT_INCLUDE,
    });
    await this.jobs.reindexProduct(product.id);
    return product;
  }

  async findManyForAdmin(query: ProductQueryDto): Promise<Paginated<unknown>> {
    const where: Prisma.ProductWhereInput = {
      deletedAt: null,
      status: query.status,
      categoryId: query.categoryId,
      name: query.search
        ? { contains: query.search, mode: 'insensitive' }
        : undefined,
    };
    return this.runPaginatedQuery(where, query);
  }

  async findManyForStorefront(query: ProductQueryDto): Promise<Paginated<unknown>> {
    if (query.search?.trim()) {
      return this.searchStorefront(query.search.trim(), query);
    }
    const where: Prisma.ProductWhereInput = {
      deletedAt: null,
      status: ProductStatus.ACTIVE,
      categoryId: query.categoryId,
    };
    return this.runPaginatedQuery(where, query);
  }

  // Full-text search over the maintained `searchVector`, ranked by relevance. Matching
  // ids are resolved via raw SQL, then hydrated through Prisma to keep includes/types.
  private async searchStorefront(
    term: string,
    query: ProductQueryDto,
  ): Promise<Paginated<unknown>> {
    const { page, pageSize } = query;
    const offset = (page - 1) * pageSize;
    const categoryFilter = query.categoryId
      ? Prisma.sql`AND "categoryId" = ${query.categoryId}::uuid`
      : Prisma.empty;
    const tsquery = Prisma.sql`websearch_to_tsquery('english', ${term})`;
    const matchClause = Prisma.sql`
      "deletedAt" IS NULL AND "status" = 'ACTIVE'
      AND "searchVector" @@ ${tsquery} ${categoryFilter}`;

    const ranked = await this.prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT "id" FROM "products"
      WHERE ${matchClause}
      ORDER BY ts_rank("searchVector", ${tsquery}) DESC, "createdAt" DESC
      LIMIT ${pageSize} OFFSET ${offset}`);

    const [{ count }] = await this.prisma.$queryRaw<{ count: bigint }[]>(Prisma.sql`
      SELECT count(*)::bigint AS count FROM "products" WHERE ${matchClause}`);

    const ids = ranked.map((row) => row.id);
    if (ids.length === 0) return paginate([], Number(count), page, pageSize);

    const products = await this.prisma.product.findMany({
      where: { id: { in: ids } },
      include: PRODUCT_INCLUDE,
    });
    const ordered = ids
      .map((id) => products.find((product) => product.id === id))
      .filter((product): product is (typeof products)[number] => Boolean(product));

    return paginate(ordered, Number(count), page, pageSize);
  }

  async findBySlug(slug: string) {
    const product = await this.prisma.product.findFirst({
      where: { slug, deletedAt: null, status: ProductStatus.ACTIVE },
      include: PRODUCT_INCLUDE,
    });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async findOneForAdmin(id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, deletedAt: null },
      include: PRODUCT_INCLUDE,
    });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async update(id: string, dto: UpdateProductDto) {
    await this.findOneForAdmin(id);
    const product = await this.prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id },
        data: {
          name: dto.name,
          description: dto.description,
          status: dto.status,
          brand: dto.brand,
          attributes: dto.attributes as Prisma.InputJsonValue | undefined,
          categoryId:
            dto.categoryId === undefined ? undefined : dto.categoryId,
          publishedAt: dto.status === ProductStatus.ACTIVE ? new Date() : undefined,
        },
      });

      if (dto.variants) await this.syncVariants(tx, id, dto.variants);
      if (dto.images) await this.syncImages(tx, id, dto.images);

      return tx.product.findUniqueOrThrow({ where: { id }, include: PRODUCT_INCLUDE });
    });
    await this.jobs.reindexProduct(id);
    return product;
  }

  async remove(id: string) {
    await this.findOneForAdmin(id);
    await this.prisma.product.update({
      where: { id },
      data: { deletedAt: new Date(), status: ProductStatus.ARCHIVED },
    });
    return { message: 'Product archived' };
  }

  private async runPaginatedQuery(
    where: Prisma.ProductWhereInput,
    query: ProductQueryDto,
  ): Promise<Paginated<unknown>> {
    const { page, pageSize } = query;
    const [data, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        include: PRODUCT_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.product.count({ where }),
    ]);
    return paginate(data, total, page, pageSize);
  }

  private toVariantCreate(v: ProductVariantDto): Prisma.ProductVariantCreateWithoutProductInput {
    return {
      sku: v.sku,
      name: v.name,
      priceAmount: v.priceAmount,
      compareAtAmount: v.compareAtAmount,
      inventoryQuantity: v.inventoryQuantity ?? 0,
      options: (v.options ?? {}) as Prisma.InputJsonValue,
      isActive: v.isActive ?? true,
    };
  }

  private async syncVariants(
    tx: Prisma.TransactionClient,
    productId: string,
    variants: ProductVariantDto[],
  ): Promise<void> {
    const keepIds = variants.filter((v) => v.id).map((v) => v.id as string);
    await tx.productVariant.deleteMany({
      where: keepIds.length
        ? { productId, id: { notIn: keepIds } }
        : { productId },
    });
    for (const variant of variants) {
      if (variant.id) {
        await tx.productVariant.update({
          where: { id: variant.id },
          data: this.toVariantCreate(variant),
        });
      } else {
        await tx.productVariant.create({
          data: { productId, ...this.toVariantCreate(variant) },
        });
      }
    }
  }

  private async syncImages(
    tx: Prisma.TransactionClient,
    productId: string,
    images: { url: string; alt?: string; position?: number }[],
  ): Promise<void> {
    await tx.productImage.deleteMany({ where: { productId } });
    if (!images.length) return;
    await tx.productImage.createMany({
      data: images.map((image, index) => ({
        productId,
        url: image.url,
        alt: image.alt,
        position: image.position ?? index,
      })),
    });
  }
}
