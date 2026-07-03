import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HealthCheckError, HealthIndicator, HealthIndicatorResult } from '@nestjs/terminus';
import IORedis from 'ioredis';
import { RedisConfig } from '../config/configuration';

@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
  constructor(private readonly config: ConfigService) {
    super();
  }

  async check(key: string): Promise<HealthIndicatorResult> {
    const redis = this.config.getOrThrow<RedisConfig>('redis');
    const client = new IORedis(redis.url, {
      lazyConnect: true,
      connectTimeout: 2000,
      maxRetriesPerRequest: 1,
    });

    try {
      await client.connect();
      await client.ping();
      return this.getStatus(key, true);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Redis unreachable';
      throw new HealthCheckError(
        'Redis check failed',
        this.getStatus(key, false, { message }),
      );
    } finally {
      client.disconnect();
    }
  }
}
