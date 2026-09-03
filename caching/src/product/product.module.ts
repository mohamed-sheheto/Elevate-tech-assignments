import { Module } from '@nestjs/common';
import { ProductService } from './product.service';
import { ProductController } from './product.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from './entities/product.entity';
import { OutboxModule } from 'src/outbox/outbox.module';
import { VersionedCacheModule } from 'src/versioned-cache/versioned-cache.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Product]),
    OutboxModule,
    VersionedCacheModule,
  ],
  controllers: [ProductController],
  providers: [ProductService],
})
export class ProductModule {}
