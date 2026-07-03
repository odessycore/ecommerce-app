import { DynamicModule, Global, Module, Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { RedisConfig } from '../config/configuration';
import { AiModule } from '../ai/ai.module';
import { JobsService } from './jobs.service';
import { IndexingService } from './indexing.service';
import { EmailProcessor } from './processors/email.processor';
import { CatalogIndexProcessor } from './processors/catalog-index.processor';
import {
  CATALOG_INDEX_QUEUE,
  EMAIL_QUEUE,
  isQueueEnabled,
  redisConnectionFromUrl,
} from './queue.constants';

@Global()
@Module({})
export class JobsModule {
  static register(): DynamicModule {
    const enabled = isQueueEnabled();
    const providers: Provider[] = [JobsService, IndexingService];
    const imports: DynamicModule['imports'] = [AiModule];

    if (enabled) {
      imports.push(
        BullModule.forRootAsync({
          inject: [ConfigService],
          useFactory: (config: ConfigService) => ({
            connection: redisConnectionFromUrl(
              config.getOrThrow<RedisConfig>('redis').url,
            ),
          }),
        }),
        BullModule.registerQueue({ name: EMAIL_QUEUE }, { name: CATALOG_INDEX_QUEUE }),
      );
      providers.push(EmailProcessor, CatalogIndexProcessor);
    }

    return {
      module: JobsModule,
      imports,
      providers,
      exports: [JobsService, IndexingService],
    };
  }
}
