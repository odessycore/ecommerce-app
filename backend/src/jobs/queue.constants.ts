export const EMAIL_QUEUE = 'email';
export const CATALOG_INDEX_QUEUE = 'catalog-index';

export const EmailJob = {
  Verification: 'verification',
  PasswordReset: 'password-reset',
} as const;

export const CatalogIndexJob = {
  Reindex: 'reindex',
} as const;

export interface EmailJobData {
  to: string;
  token: string;
}

export interface ReindexJobData {
  productId: string;
}

export function isQueueEnabled(): boolean {
  return (process.env.QUEUE_ENABLED ?? 'true') !== 'false';
}

export function redisConnectionFromUrl(url: string) {
  const parsed = new URL(url);
  const db = parsed.pathname.replace('/', '');
  return {
    host: parsed.hostname,
    port: Number(parsed.port || 6379),
    username: parsed.username || undefined,
    password: parsed.password || undefined,
    db: db ? Number(db) : undefined,
    tls: parsed.protocol === 'rediss:' ? {} : undefined,
    maxRetriesPerRequest: null as null,
  };
}
