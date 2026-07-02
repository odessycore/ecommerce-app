import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  Get,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { ChatEvent, ChatService } from './chat.service';
import { RecommendationsService } from './recommendations.service';
import { ChatDto } from './dto/chat.dto';

@Public()
@Controller('ai')
export class AiController {
  constructor(
    private readonly chat: ChatService,
    private readonly recommendations: RecommendationsService,
  ) {}

  @Post('chat')
  async streamChat(
    @Body() dto: ChatDto,
    @Req() req: Request,
    @Res() res: Response,
    @CurrentUser() user?: AuthenticatedUser,
  ): Promise<void> {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    let closed = false;
    req.on('close', () => {
      closed = true;
    });

    const send = (event: ChatEvent) => {
      if (!closed && !res.writableEnded) res.write(`data: ${JSON.stringify(event)}\n\n`);
    };
    try {
      for await (const event of this.chat.run({
        message: dto.message,
        history: dto.history,
        actor: user ? { id: user.id, role: user.role } : undefined,
      })) {
        if (closed) break;
        send(event);
      }
    } catch {
      send({ type: 'error', message: 'The assistant is temporarily unavailable.' });
      send({ type: 'done' });
    } finally {
      if (!res.writableEnded) res.end();
    }
  }

  @Get('recommendations/:productId')
  recommend(
    @Param('productId', ParseUUIDPipe) productId: string,
    @CurrentUser() user?: AuthenticatedUser,
    @Query('limit') limit?: string,
  ) {
    return this.recommendations.forProduct(productId, user?.id, limit ? parseInt(limit, 10) : 6);
  }
}
