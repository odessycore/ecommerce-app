import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { MailService } from '../mail/mail.service';
import { IndexingService } from './indexing.service';
import {
  CATALOG_INDEX_QUEUE,
  CatalogIndexJob,
  EMAIL_QUEUE,
  EmailJob,
} from './queue.constants';

// Single producer surface. When the queue is enabled the work is dispatched to BullMQ;
// otherwise (or if enqueueing fails) it runs inline so no flow silently drops.
@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);

  constructor(
    private readonly mail: MailService,
    private readonly indexing: IndexingService,
    @Optional() @InjectQueue(EMAIL_QUEUE) private readonly emailQueue?: Queue,
    @Optional() @InjectQueue(CATALOG_INDEX_QUEUE) private readonly indexQueue?: Queue,
  ) {}

  async sendVerificationEmail(to: string, token: string): Promise<void> {
    await this.dispatch(
      this.emailQueue,
      EmailJob.Verification,
      { to, token },
      () => this.mail.sendVerificationEmail(to, token),
    );
  }

  async sendPasswordResetEmail(to: string, token: string): Promise<void> {
    await this.dispatch(
      this.emailQueue,
      EmailJob.PasswordReset,
      { to, token },
      () => this.mail.sendPasswordResetEmail(to, token),
    );
  }

  async reindexProduct(productId: string): Promise<void> {
    await this.dispatch(
      this.indexQueue,
      CatalogIndexJob.Reindex,
      { productId },
      () => this.indexing.reindexProduct(productId),
    );
  }

  private async dispatch(
    queue: Queue | undefined,
    jobName: string,
    data: object,
    inline: () => Promise<void>,
  ): Promise<void> {
    if (queue) {
      try {
        await queue.add(jobName, data, {
          attempts: 5,
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: 1000,
          removeOnFail: 5000,
        });
        return;
      } catch (error) {
        this.logger.warn(
          `Enqueue of "${jobName}" failed, running inline: ${(error as Error).message}`,
        );
      }
    }
    await inline();
  }
}
