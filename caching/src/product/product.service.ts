import { Injectable } from '@nestjs/common';
import { CreateProductDto } from './dto/create-product.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Product } from './entities/product.entity';
import { Repository } from 'typeorm';
import { VersionedCacheService } from 'src/versioned-cache/versioned-cache.service';
import { OutboxService } from 'src/outbox/outbox.service';

@Injectable()
export class ProductService {
  constructor(
    @InjectRepository(Product) private productRepo: Repository<Product>,
    private readonly cache: VersionedCacheService,
    private readonly outboxService: OutboxService,
  ) {}

  async createUsingOutbox(createProductDto: CreateProductDto) {
    return this.productRepo.manager.transaction(async (manager) => {
      const product = manager.create(Product, createProductDto);
      const saved = await manager.save(product);

      await this.outboxService.createEntry(manager, {
        aggregateType: 'product',
        aggregateId: saved.id,
        cacheKey: `product:${saved.id}`,
        payload: saved,
        version: saved.version,
      });

      console.log('product created: ', saved);
      return saved;
    });
  }

  async findOne(id: string): Promise<Product | null> {
    const cached = await this.cache.read(id);
    if (cached) return JSON.parse(cached.value) as Product;

    const product = await this.productRepo.findOneBy({ id });
    if (product)
      await this.cache.writeBehind(id, product, Number(product.version));

    return product;
  }

  async updateUsingVersionedCache(
    id: string,
    patch: Partial<Product>,
  ): Promise<Product> {
    const current = await this.findOne(id);
    if (!current) throw new Error('product not found');

    const updated: Product = {
      ...current,
      ...patch,
      version: Number(current.version) + 1,
    };

    await this.cache.writeBehind(id, updated, updated.version);

    return updated;
  }
}
