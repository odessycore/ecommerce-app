import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiConfig } from '../config/configuration';
import { AiController } from './ai.controller';
import { ChatService } from './chat.service';
import { EmbeddingService } from './embedding.service';
import { SemanticSearchService } from './semantic-search.service';
import { IntentExtractionService } from './intent-extraction.service';
import { RecommendationsService } from './recommendations.service';
import {
  CHAT_PROVIDER,
  ChatProvider,
  EMBEDDING_PROVIDER,
  EmbeddingProvider,
} from './providers/types';
import { HuggingFaceProvider } from './providers/huggingface.provider';
import { OpenAiCompatibleProvider } from './providers/openai-compatible.provider';
import { NullProvider } from './providers/null.provider';

function buildProvider(ai: AiConfig, kind: AiConfig['chatProvider']) {
  if (kind === 'huggingface') {
    return new HuggingFaceProvider({ ...ai.hf, dimension: ai.embeddingDim });
  }
  if (kind === 'openai') {
    return new OpenAiCompatibleProvider({ ...ai.openai, dimension: ai.embeddingDim });
  }
  return new NullProvider();
}

@Module({
  controllers: [AiController],
  providers: [
    {
      provide: CHAT_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService): ChatProvider => {
        const ai = config.getOrThrow<AiConfig>('ai');
        return buildProvider(ai, ai.chatProvider);
      },
    },
    {
      provide: EMBEDDING_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService): EmbeddingProvider => {
        const ai = config.getOrThrow<AiConfig>('ai');
        return buildProvider(ai, ai.embeddingProvider);
      },
    },
    EmbeddingService,
    SemanticSearchService,
    IntentExtractionService,
    ChatService,
    RecommendationsService,
  ],
  exports: [EmbeddingService],
})
export class AiModule {}
