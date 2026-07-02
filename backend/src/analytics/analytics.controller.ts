import { Body, Controller, Post } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { AnalyticsService } from './analytics.service';
import { TrackEventDto } from './dto/track-event.dto';

@Public()
@Controller('events')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Post()
  async ingest(
    @Body() dto: TrackEventDto,
    @CurrentUser() user?: AuthenticatedUser,
  ): Promise<{ accepted: true }> {
    await this.analytics.track({ ...dto, userId: user?.id });
    return { accepted: true };
  }
}
