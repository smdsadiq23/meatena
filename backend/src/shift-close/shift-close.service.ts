import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { JwtUser } from '../auth/jwt.strategy';
import { roundMoney } from '../common/utils/money';
import { Payment } from '../payment/payment.entity';
import { UserRole } from '../user/user-role.enum';
import { CreateShiftCloseDto } from './dto/create-shift-close.dto';
import { ReviewShiftCloseDto } from './dto/review-shift-close.dto';
import { ShiftClose } from './shift-close.entity';

@Injectable()
export class ShiftCloseService {
  constructor(
    @InjectRepository(ShiftClose)
    private readonly shiftCloseRepo: Repository<ShiftClose>,

    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
  ) {}

  async getSummary(date: string | undefined, user: JwtUser, userId?: number) {
    const targetDate = this.resolveDate(date);
    const targetUserId = this.resolveUserScope(user, userId);
    const payments = await this.getPaymentsForDate(targetDate, targetUserId);
    const summary = this.summarizePayments(payments);
    const close = targetUserId
      ? await this.shiftCloseRepo.findOne({
          where: { user_id: targetUserId, date: targetDate },
        })
      : null;

    return {
      date: targetDate,
      user_id: targetUserId,
      ...summary,
      close,
    };
  }

  async submit(data: CreateShiftCloseDto, user: JwtUser) {
    const date = this.resolveDate(data.date);
    const existing = await this.shiftCloseRepo.findOne({
      where: { user_id: user.sub, date },
    });

    if (existing?.status === 'reviewed') {
      throw new BadRequestException('Reviewed shift close cannot be changed');
    }

    const payments = await this.getPaymentsForDate(date, user.sub);
    const summary = this.summarizePayments(payments);
    const counted_cash = roundMoney(data.counted_cash);
    const counted_knet = roundMoney(data.counted_knet ?? 0);
    const counted_total = roundMoney(counted_cash + counted_knet);
    const now = new Date().toISOString();

    return this.shiftCloseRepo.save({
      ...(existing ?? {}),
      user_id: user.sub,
      username: user.username,
      role: user.role,
      date,
      system_cash: summary.system_cash,
      system_knet: summary.system_knet,
      system_total: summary.system_total,
      counted_cash,
      counted_knet,
      counted_total,
      variance_cash: roundMoney(counted_cash - summary.system_cash),
      variance_knet: roundMoney(counted_knet - summary.system_knet),
      variance_total: roundMoney(counted_total - summary.system_total),
      notes: data.notes?.trim() || null,
      status: 'submitted',
      reviewed_by: null,
      reviewed_at: null,
      review_notes: null,
      created_at: existing?.created_at ?? now,
      updated_at: now,
    });
  }

  findAll(user: JwtUser) {
    const where = user.role === UserRole.Admin ? {} : { user_id: user.sub };

    return this.shiftCloseRepo.find({
      where,
      order: { date: 'DESC', id: 'DESC' },
      take: 120,
    });
  }

  async review(id: number, data: ReviewShiftCloseDto, user: JwtUser) {
    if (user.role !== UserRole.Admin) {
      throw new ForbiddenException('Only admins can review shift closes');
    }

    const close = await this.shiftCloseRepo.findOne({ where: { id } });

    if (!close) {
      throw new NotFoundException('Shift close not found');
    }

    return this.shiftCloseRepo.save({
      ...close,
      status: 'reviewed',
      reviewed_by: user.sub,
      reviewed_at: new Date().toISOString(),
      review_notes: data.notes?.trim() || null,
      updated_at: new Date().toISOString(),
    });
  }

  private resolveDate(date?: string) {
    if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return date;
    }

    return new Date().toISOString().slice(0, 10);
  }

  private resolveUserScope(user: JwtUser, userId?: number) {
    if (user.role !== UserRole.Admin) {
      return user.sub;
    }

    return userId && Number.isInteger(userId) && userId > 0 ? userId : null;
  }

  private getPaymentsForDate(date: string, userId: number | null) {
    return this.paymentRepo.find().then((payments) =>
      payments.filter((payment) => {
        if (payment.status === 'reversed' || !payment.date.startsWith(date)) {
          return false;
        }

        return userId ? payment.created_by === userId : true;
      }),
    );
  }

  private summarizePayments(payments: Payment[]) {
    let system_cash = 0;
    let system_knet = 0;

    for (const payment of payments) {
      const amount = Number(payment.amount);

      if (payment.mode === 'knet' || payment.mode === 'card') {
        system_knet = roundMoney(system_knet + amount);
      } else {
        system_cash = roundMoney(system_cash + amount);
      }
    }

    return {
      payment_count: payments.length,
      system_cash,
      system_knet,
      system_total: roundMoney(system_cash + system_knet),
    };
  }
}
