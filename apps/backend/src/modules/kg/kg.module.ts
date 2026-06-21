import { Module } from '@nestjs/common';
import { KgService } from './kg.service';

@Module({
  providers: [KgService],
  exports: [KgService],
})
export class KgModule {}
