import { IsEnum, IsObject, IsOptional, IsString, IsUUID } from 'class-validator';
import { AnalyticsEventType } from '@prisma/client';

export interface TrackEventInput {
  type: AnalyticsEventType;
  userId?: string;
  anonymousId?: string;
  sessionId?: string;
  productId?: string;
  variantId?: string;
  data?: Record<string, unknown>;
}

export class TrackEventDto {
  @IsEnum(AnalyticsEventType)
  type: AnalyticsEventType;

  @IsOptional()
  @IsString()
  anonymousId?: string;

  @IsOptional()
  @IsString()
  sessionId?: string;

  @IsOptional()
  @IsUUID()
  productId?: string;

  @IsOptional()
  @IsUUID()
  variantId?: string;

  @IsOptional()
  @IsObject()
  data?: Record<string, unknown>;
}
