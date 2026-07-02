export interface AppConfig {
  env: string;
  port: number;
  apiPrefix: string;
  webAppUrl: string;
}

export interface JwtConfig {
  accessSecret: string;
  accessTtl: string;
  refreshTtlDays: number;
  refreshCookie: string;
}

export interface GoogleConfig {
  clientId: string;
  clientSecret: string;
  callbackUrl: string;
}

export interface MailConfig {
  host: string;
  port: number;
  user?: string;
  password?: string;
  secure: boolean;
  from: string;
}

export interface StripeConfig {
  secretKey: string;
  webhookSecret: string;
  currency: string;
}

export interface RedisConfig {
  url: string;
  enabled: boolean;
}

export interface ObservabilityConfig {
  sentryDsn: string;
  logLevel: string;
}

export interface CheckoutConfig {
  reservationTtlMinutes: number;
}

export type AiProviderKind = 'huggingface' | 'openai' | 'none';

export interface AiConfig {
  chatProvider: AiProviderKind;
  embeddingProvider: AiProviderKind;
  embeddingDim: number;
  maxContextProducts: number;
  hf: {
    apiKey: string;
    baseUrl: string;
    chatModel: string;
    embeddingModel: string;
  };
  openai: {
    apiKey: string;
    baseUrl: string;
    chatModel: string;
    embeddingModel: string;
  };
}

export const configuration = () => ({
  app: {
    env: process.env.NODE_ENV ?? 'development',
    port: parseInt(process.env.PORT ?? '4000', 10),
    apiPrefix: process.env.API_PREFIX ?? 'api',
    webAppUrl: process.env.WEB_APP_URL ?? 'http://localhost:5173',
  } satisfies AppConfig,
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET ?? 'insecure-dev-secret',
    accessTtl: process.env.JWT_ACCESS_TTL ?? '900s',
    refreshTtlDays: parseInt(process.env.REFRESH_TOKEN_TTL_DAYS ?? '30', 10),
    refreshCookie: process.env.REFRESH_TOKEN_COOKIE ?? 'refresh_token',
  } satisfies JwtConfig,
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID ?? '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    callbackUrl:
      process.env.GOOGLE_CALLBACK_URL ??
      'http://localhost:4000/api/auth/google/callback',
  } satisfies GoogleConfig,
  mail: {
    host: process.env.SMTP_HOST ?? 'localhost',
    port: parseInt(process.env.SMTP_PORT ?? '1025', 10),
    user: process.env.SMTP_USER || undefined,
    password: process.env.SMTP_PASSWORD || undefined,
    secure: process.env.SMTP_SECURE === 'true',
    from: process.env.MAIL_FROM ?? 'Acme Store <no-reply@acme.test>',
  } satisfies MailConfig,
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY ?? '',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? '',
    currency: process.env.STRIPE_CURRENCY ?? 'usd',
  } satisfies StripeConfig,
  redis: {
    url: process.env.REDIS_URL ?? 'redis://localhost:6379',
    enabled: (process.env.QUEUE_ENABLED ?? 'true') !== 'false',
  } satisfies RedisConfig,
  observability: {
    sentryDsn: process.env.SENTRY_DSN ?? '',
    logLevel: process.env.LOG_LEVEL ?? 'info',
  } satisfies ObservabilityConfig,
  checkout: {
    reservationTtlMinutes: parseInt(process.env.ORDER_RESERVATION_TTL_MINUTES ?? '30', 10),
  } satisfies CheckoutConfig,
  ai: {
    chatProvider: (process.env.AI_CHAT_PROVIDER ?? 'none') as AiProviderKind,
    embeddingProvider: (process.env.AI_EMBEDDING_PROVIDER ?? 'none') as AiProviderKind,
    embeddingDim: parseInt(process.env.AI_EMBEDDING_DIM ?? '384', 10),
    maxContextProducts: parseInt(process.env.AI_MAX_CONTEXT_PRODUCTS ?? '8', 10),
    hf: {
      apiKey: process.env.HF_API_KEY ?? '',
      baseUrl: process.env.HF_BASE_URL ?? 'https://api-inference.huggingface.co',
      chatModel: process.env.HF_CHAT_MODEL ?? 'meta-llama/Llama-3.1-8B-Instruct',
      embeddingModel: process.env.HF_EMBEDDING_MODEL ?? 'BAAI/bge-small-en-v1.5',
    },
    openai: {
      apiKey: process.env.OPENAI_API_KEY ?? '',
      baseUrl: process.env.OPENAI_BASE_URL ?? 'http://localhost:8000/v1',
      chatModel: process.env.OPENAI_CHAT_MODEL ?? 'meta-llama/Llama-3.1-8B-Instruct',
      embeddingModel: process.env.OPENAI_EMBEDDING_MODEL ?? 'BAAI/bge-small-en-v1.5',
    },
  } satisfies AiConfig,
});

export type Configuration = ReturnType<typeof configuration>;
