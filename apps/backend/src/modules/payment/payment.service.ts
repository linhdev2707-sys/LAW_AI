import {
  Injectable,
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Transaction } from './entities/transaction.entity';
import { User } from '../user/entities/user.entity';

const PLAN_PRICES: Record<string, { price: number; name: string }> = {
  basic: { price: 49000, name: 'Cơ bản' },
  pro: { price: 99000, name: 'Plus' },
  premium: { price: 249000, name: 'Pro' },
};

@Injectable()
export class PaymentService {
  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly configService: ConfigService,
  ) {}

  async checkout(userId: string, planId: string, durationMonths = 1) {
    const planConfig = PLAN_PRICES[planId.toLowerCase()];
    if (!planConfig) {
      throw new BadRequestException(`Gói dịch vụ "${planId}" không hợp lệ`);
    }

    // Calculate total amount based on duration: 3 months (20% off), 6 months (30% off), 12 months (50% off)
    let discountMultiplier = 1.0;
    if (durationMonths === 3) {
      discountMultiplier = 0.8;
    } else if (durationMonths === 6) {
      discountMultiplier = 0.7;
    } else if (durationMonths === 12) {
      discountMultiplier = 0.5;
    }
    const amount = Math.round(planConfig.price * durationMonths * discountMultiplier);

    // Generate unique code LAWxxxxx
    let code = '';
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let isUnique = false;

    while (!isUnique) {
      code = 'LAW';
      for (let i = 0; i < 5; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }

      const existing = await this.transactionRepository.findOne({ where: { code } });
      if (!existing) {
        isUnique = true;
      }
    }

    const transaction = this.transactionRepository.create({
      userId,
      code,
      plan: planId.toLowerCase(),
      amount,
      status: 'pending',
      paymentGateway: 'casso',
      durationMonths,
    });

    await this.transactionRepository.save(transaction);

    // Load bank configs
    const bankId = this.configService.get<string>('app.payment.bankId', 'TCB');
    const accountNo = this.configService.get<string>('app.payment.accountNo', '19039988776601');
    const accountName = this.configService.get<string>(
      'app.payment.accountName',
      'CONG TY CONG NGHE iLaw',
    );
    const template = this.configService.get<string>('app.payment.template', 'qr_only');

    // Build transfer content with plan suffix
    let suffix = '';
    const lowerPlan = planId.toLowerCase();
    if (lowerPlan === 'basic') suffix = 'COBAN';
    else if (lowerPlan === 'pro') suffix = 'PLUS';
    else if (lowerPlan === 'premium') suffix = 'PRO';

    const transferContent = suffix ? `${code} ${suffix}` : code;

    // Build VietQR link
    const qrUrl = `https://img.vietqr.io/image/${bankId}-${accountNo}-${template}.png?amount=${transaction.amount}&addInfo=${encodeURIComponent(transferContent)}&accountName=${encodeURIComponent(accountName)}`;

    return {
      id: transaction.id,
      code: transaction.code,
      plan: transaction.plan,
      amount: transaction.amount,
      qrUrl,
      bankId,
      accountNo,
      accountName,
      transferContent,
    };
  }

  async getStatus(userId: string, code: string) {
    const transaction = await this.transactionRepository.findOne({
      where: { code: code.toUpperCase() },
    });

    if (!transaction) {
      throw new NotFoundException(`Không tìm thấy giao dịch với mã ${code}`);
    }

    if (transaction.userId !== userId) {
      throw new UnauthorizedException('Bạn không có quyền truy cập giao dịch này');
    }

    return {
      code: transaction.code,
      status: transaction.status,
      paidAt: transaction.paidAt,
    };
  }

  async handleCassoWebhook(secureToken: string, payload: any) {
    const configuredToken = this.configService.get<string>(
      'app.payment.cassoWebhookToken',
      'casso-secure-token',
    );

    if (secureToken !== configuredToken) {
      throw new UnauthorizedException('Mã bảo mật Secure-Token không chính xác');
    }

    if (!payload || payload.error !== 0 || !Array.isArray(payload.data)) {
      return { success: true, message: 'Dữ liệu webhook không có giao dịch mới' };
    }

    const transactions = payload.data;
    const processed: string[] = [];

    for (const tx of transactions) {
      const description = tx.description || '';
      const amount = tx.amount || 0;
      const tid = tx.tid || tx.id?.toString() || '';

      // Match code pattern LAW[A-Z0-9]{5}
      const match = description.match(/LAW[A-Z0-9]{5}/i);
      if (!match) continue;

      const code = match[0].toUpperCase();
      const dbTx = await this.transactionRepository.findOne({
        where: { code, status: 'pending' },
      });

      if (dbTx) {
        // Verify amount
        if (amount >= dbTx.amount) {
          // Update transaction
          dbTx.status = 'completed';
          dbTx.transactionId = tid;
          dbTx.paidAt = new Date();
          await this.transactionRepository.save(dbTx);

          // Upgrade user subscription
          const user = await this.userRepository.findOne({ where: { id: dbTx.userId } });
          if (user) {
            user.subscriptionPlan = dbTx.plan;
            const expiresAt = new Date();
            expiresAt.setMonth(expiresAt.getMonth() + (dbTx.durationMonths || 1));
            user.subscriptionExpiresAt = expiresAt;
            await this.userRepository.save(user);
          }

          processed.push(code);
        }
      }
    }

    return {
      success: true,
      message: `Xử lý thành công các mã giao dịch: ${processed.join(', ')}`,
      processed,
    };
  }

  async adminGetTransactions(query: {
    page: number;
    limit: number;
    search?: string;
    status?: string;
    plan?: string;
  }) {
    const { page, limit, search, status, plan } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.transactionRepository
      .createQueryBuilder('tx')
      .leftJoin(User, 'u', 'u.id = tx.user_id')
      .select([
        'tx.id AS id',
        'tx.userId AS "userId"',
        'tx.code AS code',
        'tx.plan AS plan',
        'tx.amount AS amount',
        'tx.status AS status',
        'tx.paymentGateway AS "paymentGateway"',
        'tx.transactionId AS "transactionId"',
        'tx.paidAt AS "paidAt"',
        'tx.createdAt AS "createdAt"',
        'tx.updatedAt AS "updatedAt"',
        'u.email AS "userEmail"',
        'u.fullName AS "userFullName"',
      ])
      .orderBy('tx.createdAt', 'DESC')
      .offset(skip)
      .limit(limit);

    if (search) {
      queryBuilder.andWhere(
        '(tx.code ILIKE :search OR u.email ILIKE :search OR u.fullName ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    if (status) {
      queryBuilder.andWhere('tx.status = :status', { status: status.toLowerCase() });
    }

    if (plan) {
      queryBuilder.andWhere('tx.plan = :plan', { plan: plan.toLowerCase() });
    }

    const items = await queryBuilder.getRawMany();

    const countQueryBuilder = this.transactionRepository
      .createQueryBuilder('tx')
      .leftJoin(User, 'u', 'u.id = tx.user_id');

    if (search) {
      countQueryBuilder.andWhere(
        '(tx.code ILIKE :search OR u.email ILIKE :search OR u.fullName ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    if (status) {
      countQueryBuilder.andWhere('tx.status = :status', { status: status.toLowerCase() });
    }

    if (plan) {
      countQueryBuilder.andWhere('tx.plan = :plan', { plan: plan.toLowerCase() });
    }

    const total = await countQueryBuilder.getCount();

    return {
      items,
      total,
      page,
      limit,
    };
  }

  async adminGetStats() {
    const revenueRes = await this.transactionRepository
      .createQueryBuilder('tx')
      .select('SUM(tx.amount)', 'sum')
      .where("tx.status = 'completed'")
      .getRawOne();
    const totalRevenue = parseInt(revenueRes?.sum || '0', 10);

    const statusCounts = await this.transactionRepository
      .createQueryBuilder('tx')
      .select('tx.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('tx.status')
      .getRawMany();

    const countsByStatus = {
      pending: 0,
      completed: 0,
      failed: 0,
    };
    statusCounts.forEach((row) => {
      const status = row.status;
      if (status in countsByStatus) {
        countsByStatus[status as keyof typeof countsByStatus] = parseInt(row.count, 10);
      }
    });

    const planCounts = await this.transactionRepository
      .createQueryBuilder('tx')
      .select('tx.plan', 'plan')
      .addSelect('COUNT(*)', 'count')
      .where("tx.status = 'completed'")
      .groupBy('tx.plan')
      .getRawMany();

    const countsByPlan: Record<string, number> = {
      basic: 0,
      pro: 0,
      premium: 0,
    };
    planCounts.forEach((row) => {
      const plan = row.plan;
      countsByPlan[plan] = parseInt(row.count, 10);
    });

    const monthlyTrend = await this.transactionRepository
      .createQueryBuilder('tx')
      .select("TO_CHAR(tx.createdAt, 'YYYY-MM')", 'month')
      .addSelect('SUM(tx.amount)', 'revenue')
      .addSelect('COUNT(*)', 'count')
      .where("tx.status = 'completed'")
      .groupBy("TO_CHAR(tx.createdAt, 'YYYY-MM')")
      .orderBy("TO_CHAR(tx.createdAt, 'YYYY-MM')", 'ASC')
      .limit(6)
      .getRawMany();

    const trend = monthlyTrend.map((row) => ({
      month: row.month,
      revenue: parseInt(row.revenue || '0', 10),
      count: parseInt(row.count || '0', 10),
    }));

    return {
      totalRevenue,
      countsByStatus,
      countsByPlan,
      monthlyTrend: trend,
    };
  }

  async confirmTransfer(userId: string, code: string) {
    const transaction = await this.transactionRepository.findOne({
      where: { code: code.toUpperCase() },
    });

    if (!transaction) {
      throw new NotFoundException(`Không tìm thấy giao dịch với mã ${code}`);
    }

    if (transaction.userId !== userId) {
      throw new UnauthorizedException('Bạn không có quyền xác thực giao dịch này');
    }

    if (transaction.status === 'pending') {
      transaction.status = 'approval_pending';
      await this.transactionRepository.save(transaction);
    }

    return {
      code: transaction.code,
      status: transaction.status,
    };
  }

  async adminApprove(code: string) {
    const transaction = await this.transactionRepository.findOne({
      where: { code: code.toUpperCase() },
    });

    if (!transaction) {
      throw new NotFoundException(`Không tìm thấy giao dịch với mã ${code}`);
    }

    if (transaction.status === 'completed') {
      return { success: true, message: 'Giao dịch đã được duyệt trước đó.' };
    }

    transaction.status = 'completed';
    transaction.paidAt = new Date();
    transaction.transactionId = 'MANUAL_APPROVE_BY_ADMIN';
    await this.transactionRepository.save(transaction);

    // Upgrade user subscription
    const user = await this.userRepository.findOne({ where: { id: transaction.userId } });
    if (user) {
      user.subscriptionPlan = transaction.plan;
      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + (transaction.durationMonths || 1));
      user.subscriptionExpiresAt = expiresAt;
      await this.userRepository.save(user);
    }

    return {
      success: true,
      message: `Đã duyệt thành công giao dịch ${code}`,
      status: transaction.status,
    };
  }

  async adminReject(code: string) {
    const transaction = await this.transactionRepository.findOne({
      where: { code: code.toUpperCase() },
    });

    if (!transaction) {
      throw new NotFoundException(`Không tìm thấy giao dịch với mã ${code}`);
    }

    if (transaction.status === 'completed') {
      throw new BadRequestException('Không thể từ chối giao dịch đã thành công');
    }

    transaction.status = 'failed';
    await this.transactionRepository.save(transaction);

    return {
      success: true,
      message: `Đã từ chối giao dịch ${code}`,
      status: transaction.status,
    };
  }
}
