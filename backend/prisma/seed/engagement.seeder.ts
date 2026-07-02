import { PrismaClient } from '@prisma/client';
import { VariantRef } from './catalog.seeder';
import { CustomerRef } from './users.seeder';
import { REVIEW_BODIES, REVIEW_TITLES } from './datasets';
import { daysAgo, Rng } from './helpers';

export async function seedReviews(
  prisma: PrismaClient,
  rng: Rng,
  now: number,
  context: { variants: VariantRef[]; customers: CustomerRef[] },
): Promise<number> {
  const productIds = [...new Set(context.variants.map((v) => v.productId))];
  const reviewers = context.customers.filter((c) => c.isActive);
  let count = 0;

  for (const productId of productIds) {
    const reviewCount = rng.int(0, 3);
    const authors = rng.sample(reviewers, reviewCount);
    for (const author of authors) {
      await prisma.productReview.create({
        data: {
          productId,
          authorId: author.id,
          rating: rng.bool(0.75) ? rng.int(4, 5) : rng.int(2, 3),
          title: rng.pick(REVIEW_TITLES),
          body: rng.pick(REVIEW_BODIES),
          createdAt: daysAgo(now, rng.int(1, 90)),
        },
      });
      count++;
    }
  }

  return count;
}

export async function seedActiveCarts(
  prisma: PrismaClient,
  rng: Rng,
  context: { variants: VariantRef[]; customers: CustomerRef[] },
): Promise<number> {
  const shoppers = context.customers.filter((c) => c.isActive).slice(0, 2);
  let count = 0;

  for (const shopper of shoppers) {
    const items = rng.sample(context.variants, 2);
    await prisma.cart.create({
      data: {
        userId: shopper.id,
        status: 'ACTIVE',
        items: {
          create: items.map((variant) => ({
            variantId: variant.id,
            quantity: rng.int(1, 2),
            unitAmount: variant.priceAmount,
          })),
        },
      },
    });
    count++;
  }

  return count;
}
