import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { CLEAR_DIRTY_IF_UNCHANGED, SET_IF_NEWER } from './scripts/lua-scripts';
import { Product } from 'src/product/entities/product.entity';

@Injectable()
export class VersionedCacheService implements OnModuleInit {
  constructor(@InjectRedis() private readonly redis: Redis) {}

  onModuleInit() {
    this.redis.defineCommand('setIfNewer', {
      numberOfKeys: 1,
      lua: SET_IF_NEWER,
    });
    this.redis.defineCommand('clearDirtyIfUnchanged', {
      numberOfKeys: 1,
      lua: CLEAR_DIRTY_IF_UNCHANGED,
    });
  }

  private key(productId: string) {
    return `product:${productId}`;
  }

  async writeBehind(
    productId: string,
    product: Product,
    version: number,
  ): Promise<boolean> {
    const result = await this.redis.setIfNewer(
      this.key(productId),
      JSON.stringify(product),
      version,
    );

    return result === 1;
  }

  async read(productId: string) {
    const data = await this.redis.hgetall(this.key(productId));

    if (!data || !data.value) return null;
    return { value: data.value, version: Number(data.version) };
  }

  async getDirtyKeys(pattern = 'product:*'): Promise<string[]> {
    const keys = await this.redis.keys(pattern);
    if (keys.length === 0) return [];

    const pipeline = this.redis.pipeline();
    keys.forEach((k) => pipeline.hget(k, 'dirty'));

    const results = await pipeline.exec();
    return keys.filter((_, i) => results?.[i]?.[1] === '1');
  }

  async clearDirtyIfUnchanged(
    productId: string,
    flushedVersion: number,
  ): Promise<boolean> {
    const result = await this.redis.clearDirtyIfUnchanged(
      this.key(productId),
      flushedVersion,
    );
    return result === 1;
  }
}
