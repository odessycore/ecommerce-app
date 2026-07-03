import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { IndexingService } from '../indexing.service';
import { CATALOG_INDEX_QUEUE, ReindexJobData } from '../queue.constants';

@Processor(CATALOG_INDEX_QUEUE)
export class CatalogIndexProcessor extends WorkerHost {
  constructor(private readonly indexing: IndexingService) {
    super();
  }

  async process(job: Job<ReindexJobData>): Promise<void> {
    await this.indexing.reindexProduct(job.data.productId);
  }
}
