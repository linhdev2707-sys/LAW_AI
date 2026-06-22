import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Transaction } from './entities/transaction.entity';
import { User } from '../user/entities/user.entity';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';
import { QuotaService } from './quota.service';
import { SubscriptionExpirySweeper } from './subscription-expiry.sweeper';

@Module({
  imports: [TypeOrmModule.forFeature([Transaction, User])],
  controllers: [PaymentController],
  providers: [PaymentService, QuotaService, SubscriptionExpirySweeper],
  exports: [PaymentService, QuotaService],
})
export class PaymentModule {}
