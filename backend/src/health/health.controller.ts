import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HealthCheck, HealthCheckResult, HealthCheckService } from '@nestjs/terminus';
import { Public } from '../common/decorators/public.decorator';
import { RedisConfig } from '../config/configuration';
import { DatabaseHealthIndicator } from './database.health';
import { RedisHealthIndicator } from './redis.health';

@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly database: DatabaseHealthIndicator,
    private readonly redis: RedisHealthIndicator,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Get()
  liveness(): { status: string } {
    return { status: 'ok' };
  }

  @Public()
  @Get('ready')
  @HealthCheck()
  readiness(): Promise<HealthCheckResult> {
    const redisConfig = this.config.getOrThrow<RedisConfig>('redis');

    const indicators = [() => this.database.check('database')];

    if (redisConfig.enabled) {
      indicators.push(() => this.redis.check('redis'));
    }

    return this.health.check(indicators);
  }
}
