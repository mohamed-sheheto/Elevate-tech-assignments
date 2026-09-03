import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Outbox } from './entity/outbox.entity';
import { EntityManager, Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';

@Injectable()
export class OutboxService {
  private readonly logger = new Logger(OutboxService.name);
  constructor(
    @InjectRepository(Outbox) private outboxRepo: Repository<Outbox>,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  async createEntry(
    manager: EntityManager,
    data: Pick<
      Outbox,
      'aggregateType' | 'aggregateId' | 'cacheKey' | 'payload' | 'version'
    >,
  ): Promise<Outbox> {
    const entry = manager.create(Outbox, data);
    return manager.save(entry);
  }

  @Cron(CronExpression.EVERY_30_SECONDS)
  async processOutbox() {
    const entries = await this.outboxRepo.find({
      where: { status: 'PENDING' },
      order: { createdAt: 'ASC' },
      take: 50,
    });

    if (!entries.length) return;

    for (const entry of entries) {
      console.log('background job started');

      try {
        await this.applyToCache(entry);
        entry.status = 'PROCESSED';
        entry.processedAt = new Date();
        console.log('entry updated successfully');
      } catch (err) {
        entry.retryCount += 1;
        entry.status = entry.retryCount >= 5 ? 'FAILED' : 'PENDING';

        this.logger.warn(
          `Outbox entry ${entry.id} failed (attempt ${entry.retryCount}): ${(err as Error).message}`,
        );
      }

      await this.outboxRepo.save(entry);
    }
  }

  private async applyToCache(entry: Outbox) {
    const cached = await this.redis.hgetall(entry.cacheKey);

    if (cached && cached.version && Number(cached.version) >= entry.version) {
      return;
    }

    await this.redis.hset(entry.cacheKey, {
      value: JSON.stringify(entry.payload),
      version: String(entry.version),
      dirty: '0',
    });

    await this.redis.expire(entry.cacheKey, 60);
  }
}
