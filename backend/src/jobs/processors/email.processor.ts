import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { MailService } from '../../mail/mail.service';
import { EMAIL_QUEUE, EmailJob, EmailJobData } from '../queue.constants';

@Processor(EMAIL_QUEUE)
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);

  constructor(private readonly mail: MailService) {
    super();
  }

  async process(job: Job<EmailJobData>): Promise<void> {
    const { to, token } = job.data;
    switch (job.name) {
      case EmailJob.Verification:
        await this.mail.sendVerificationEmail(to, token);
        return;
      case EmailJob.PasswordReset:
        await this.mail.sendPasswordResetEmail(to, token);
        return;
      default:
        this.logger.warn(`Unknown email job: ${job.name}`);
    }
  }
}
