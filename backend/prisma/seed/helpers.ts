// Deterministic PRNG (mulberry32) so repeated seeds produce identical data.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Rng {
  private readonly next: () => number;

  constructor(seed = 0x1337c0de) {
    this.next = mulberry32(seed);
  }

  float(): number {
    return this.next();
  }

  int(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  bool(probability = 0.5): boolean {
    return this.next() < probability;
  }

  pick<T>(items: readonly T[]): T {
    return items[this.int(0, items.length - 1)];
  }

  sample<T>(items: readonly T[], count: number): T[] {
    const pool = [...items];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = this.int(0, i);
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, Math.min(count, pool.length));
  }
}

export function daysAgo(now: number, days: number): Date {
  return new Date(now - days * 24 * 60 * 60 * 1000);
}

export function minutesAfter(base: Date, minutes: number): Date {
  return new Date(base.getTime() + minutes * 60 * 1000);
}
