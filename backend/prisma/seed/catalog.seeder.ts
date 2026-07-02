import { PrismaClient, Prisma } from '@prisma/client';
import slugify from 'slugify';
import { CATALOG, ProductSeed, VariantAxis } from './datasets';

export interface VariantRef {
  id: string;
  productId: string;
  productName: string;
  variantName: string;
  sku: string;
  priceAmount: number;
  currency: string;
}

const slug = (value: string) => slugify(value, { lower: true, strict: true });

function variantOptions(axis: VariantAxis, value: string): Prisma.InputJsonValue {
  if (axis.type === 'one') return {};
  return { [axis.type]: value };
}

function buildVariants(product: ProductSeed): Prisma.ProductVariantCreateWithoutProductInput[] {
  const productSlug = slug(product.name);
  return product.axis.values.map((value, index) => ({
    sku: `${productSlug}-${slug(value) || `v${index}`}`.toUpperCase(),
    name: value,
    priceAmount: product.basePrice,
    compareAtAmount: product.compareAtPrice,
    inventoryQuantity: 18 + ((index * 13 + product.basePrice) % 64),
    options: variantOptions(product.axis, value),
  }));
}

function buildImages(product: ProductSeed): Prisma.ProductImageCreateWithoutProductInput[] {
  const productSlug = slug(product.name);
  return Array.from({ length: product.imageCount }, (_, index) => ({
    url: `https://picsum.photos/seed/${productSlug}-${index}/900/1100`,
    alt: `${product.name} — view ${index + 1}`,
    position: index,
  }));
}

export async function seedCatalog(prisma: PrismaClient): Promise<VariantRef[]> {
  const variants: VariantRef[] = [];

  for (const [categoryIndex, category] of CATALOG.entries()) {
    const parent = await prisma.category.create({
      data: {
        name: category.name,
        slug: slug(category.name),
        description: category.description,
        position: categoryIndex,
      },
    });

    for (const [subIndex, sub] of category.children.entries()) {
      const child = await prisma.category.create({
        data: {
          name: sub.name,
          slug: slug(`${category.name}-${sub.name}`),
          parentId: parent.id,
          position: subIndex,
        },
      });

      for (const product of sub.products) {
        const created = await prisma.product.create({
          data: {
            name: product.name,
            slug: slug(product.name),
            description: product.description,
            status: 'ACTIVE',
            categoryId: child.id,
            brand: product.brand,
            attributes: product.attributes as Prisma.InputJsonValue,
            publishedAt: new Date(),
            variants: { create: buildVariants(product) },
            images: { create: buildImages(product) },
          },
          include: { variants: true },
        });

        for (const variant of created.variants) {
          variants.push({
            id: variant.id,
            productId: created.id,
            productName: created.name,
            variantName: variant.name,
            sku: variant.sku,
            priceAmount: variant.priceAmount,
            currency: variant.currency,
          });
        }
      }
    }
  }

  return variants;
}
