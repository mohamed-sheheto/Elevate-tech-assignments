import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VersionedCacheService } from './versioned-cache.service';
import { VersionedCacheFlushService } from './flush.service';
import { Product } from 'src/product/entities/product.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Product])],
  providers: [VersionedCacheService, VersionedCacheFlushService],
  exports: [VersionedCacheService],
})
export class VersionedCacheModule {}
