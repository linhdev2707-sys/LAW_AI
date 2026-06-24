import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Headers,
  UseGuards,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@law-ai/shared';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { PaymentService } from './payment.service';

@ApiTags('payments')
@Controller('payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post('checkout')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  checkout(@CurrentUser('sub') userId: string, @Body() dto: { planId: string }) {
    return this.paymentService.checkout(userId, dto.planId);
  }

  @Get('status/:code')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  getStatus(@CurrentUser('sub') userId: string, @Param('code') code: string) {
    return this.paymentService.getStatus(userId, code);
  }

  @Post('casso-webhook')
  @HttpCode(HttpStatus.OK)
  async cassoWebhook(@Headers('secure-token') secureToken: string, @Body() body: any) {
    return this.paymentService.handleCassoWebhook(secureToken, body);
  }

  @Get('admin/stats')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  adminGetStats() {
    return this.paymentService.adminGetStats();
  }

  @Get('admin/transactions')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  adminGetTransactions(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('plan') plan?: string,
  ) {
    return this.paymentService.adminGetTransactions({
      page: Number(page) || 1,
      limit: Number(limit) || 20,
      search,
      status,
      plan,
    });
  }
}
