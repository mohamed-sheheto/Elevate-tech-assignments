import { Module } from '@nestjs/common';
import { OutboxService } from './outbox.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Outbox } from './entity/outbox.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Outbox])],
  providers: [OutboxService],
  exports: [OutboxService],
})
export class OutboxModule {}
