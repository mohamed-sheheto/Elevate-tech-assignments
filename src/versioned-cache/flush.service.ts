import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Product } from 'src/product/entities/product.entity';
import { Repository } from 'typeorm';
import { VersionedCacheService } from './versioned-cache.service';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class VersionedCacheFlushService {
  private readonly logger = new Logger(VersionedCacheFlushService.name);

  constructor(
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    private readonly cache: VersionedCacheService,
  ) {}

  @Cron(CronExpression.EVERY_5_SECONDS)
  async flushDirtyProducts() {
    const dirtyKeys = await this.cache.getDirtyKeys();

    for (const key of dirtyKeys) {
      const productId = key.split(':')[1];
      const cached = await this.cache.read(productId);

      if (!cached) continue;

      const product = JSON.parse(cached.value) as Product;

      const result = await this.productRepo
        .createQueryBuilder()
        .update(product)
        .set({
          name: product.name,
          price: product.price,
          stock: product.stock,
          version: product.version,
        })
        .where('id = :id AND version < :version', {
          id: productId,
          version: cached.version,
        })
        .execute();

      if (result.affected === 0) {
        await this.productRepo.upsert(
          { ...product, version: product.version },
          ['id'],
        );
      }

      const cleared = await this.cache.clearDirtyIfUnchanged(
        productId,
        cached.version,
      );
      if (!cleared)
        this.logger.debug(
          `Product ${productId} updated during flush, will retry next cycle`,
        );
    }
  }
}
