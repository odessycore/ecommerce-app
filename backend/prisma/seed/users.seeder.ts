import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import { CUSTOMERS, STREETS } from './datasets';
import { daysAgo, Rng } from './helpers';

export interface AddressSnapshot {
  fullName: string;
  line1: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
  phone: string;
}

export interface CustomerRef {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  address?: AddressSnapshot;
}

const emailFor = (first: string, last: string) =>
  `${first}.${last}`.toLowerCase().replace(/[^a-z.]/g, '') + '@example.com';

export async function seedAdmin(prisma: PrismaClient): Promise<string> {
  const admin = await prisma.user.create({
    data: {
      email: 'admin@acme.test',
      passwordHash: await argon2.hash('Admin123!'),
      firstName: 'Acme',
      lastName: 'Admin',
      role: 'ADMIN',
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
      lastLoginAt: new Date(),
    },
  });
  return admin.id;
}

export async function seedCustomers(prisma: PrismaClient, rng: Rng, now: number): Promise<CustomerRef[]> {
  const sharedPasswordHash = await argon2.hash('Password123!');
  const refs: CustomerRef[] = [];

  for (const [index, seed] of CUSTOMERS.entries()) {
    const email = emailFor(seed.firstName, seed.lastName);
    const isActive = seed.kind !== 'invited';
    const createdAt = daysAgo(now, rng.int(20, 220));

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: seed.kind === 'credential' ? sharedPasswordHash : null,
        firstName: seed.firstName,
        lastName: seed.lastName,
        phone: `+1 (555) ${String(200 + index).padStart(3, '0')}-${String(1000 + rng.int(0, 8999)).padStart(4, '0')}`,
        role: 'CUSTOMER',
        status: isActive ? 'ACTIVE' : 'INVITED',
        emailVerifiedAt: isActive ? createdAt : null,
        avatarUrl:
          seed.kind === 'google'
            ? `https://i.pravatar.cc/160?u=${encodeURIComponent(email)}`
            : null,
        lastLoginAt: isActive ? daysAgo(now, rng.int(0, 18)) : null,
        createdAt,
      },
    });

    if (seed.kind === 'google') {
      await prisma.oAuthAccount.create({
        data: {
          provider: 'GOOGLE',
          providerAccountId: `google-${100000 + index}`,
          userId: user.id,
        },
      });
    }

    let address: AddressSnapshot | undefined;
    if (isActive) {
      const snapshot: AddressSnapshot = {
        fullName: `${seed.firstName} ${seed.lastName}`,
        line1: rng.pick(STREETS),
        city: seed.city,
        region: seed.region,
        postalCode: String(rng.int(10000, 99999)),
        country: seed.country,
        phone: user.phone ?? '',
      };
      await prisma.address.create({
        data: {
          userId: user.id,
          type: 'SHIPPING',
          isDefault: true,
          ...snapshot,
        },
      });
      address = snapshot;
    }

    refs.push({
      id: user.id,
      email,
      firstName: seed.firstName,
      lastName: seed.lastName,
      isActive,
      address,
    });
  }

  return refs;
}
