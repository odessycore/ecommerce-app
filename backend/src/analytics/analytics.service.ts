import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TrackEventInput } from './dto/track-event.dto';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async track(input: TrackEventInput): Promise<void> {
    try {
      await this.prisma.analyticsEvent.create({
        data: {
          type: input.type,
          userId: input.userId,
          anonymousId: input.anonymousId,
          sessionId: input.sessionId,
          productId: input.productId,
          variantId: input.variantId,
          data: (input.data ?? {}) as Prisma.InputJsonValue,
        },
      });
    } catch (error) {
      this.logger.warn(
        `Failed to track analytics event ${input.type}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
