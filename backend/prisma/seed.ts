import { PrismaClient } from '@prisma/client';
import { Rng } from './seed/helpers';
import { resetDatabase } from './seed/reset';
import { seedCatalog } from './seed/catalog.seeder';
import { seedAdmin, seedCustomers } from './seed/users.seeder';
import { seedOrders } from './seed/orders.seeder';
import { seedActiveCarts, seedReviews } from './seed/engagement.seeder';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const rng = new Rng();
  const now = Date.now();

  await resetDatabase(prisma);

  const adminId = await seedAdmin(prisma);
  const variants = await seedCatalog(prisma);
  const customers = await seedCustomers(prisma, rng, now);
  const orderCount = await seedOrders(prisma, rng, now, { adminId, variants, customers });
  const reviewCount = await seedReviews(prisma, rng, now, { variants, customers });
  const cartCount = await seedActiveCarts(prisma, rng, { variants, customers });

  const productCount = new Set(variants.map((v) => v.productId)).size;

  console.log('Seed complete:');
  console.log(`  • ${productCount} products (${variants.length} variants)`);
  console.log(`  • ${customers.length} customers + 1 admin`);
  console.log(`  • ${orderCount} orders, ${reviewCount} reviews, ${cartCount} active carts`);
  console.log('  • Admin login:    admin@acme.test / Admin123!');
  console.log('  • Customer login: olivia.bennett@example.com / Password123!');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
