import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { AuditService } from '../audit/audit.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../user/user-role.enum';
import type { JwtUser } from '../auth/jwt.strategy';
import { CreateKnetPaymentDto } from './dto/create-knet-payment.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { ReversePaymentDto } from './dto/reverse-payment.dto';
import { PaymentService } from './payment.service';

@ApiTags('payments')
@Controller('payments')
export class PaymentController {
  constructor(
    private service: PaymentService,
    private auditService: AuditService,
  ) {}

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Admin, UserRole.Staff)
  @ApiCreatedResponse({ description: 'Payment recorded successfully.' })
  @Post()
  async create(
    @Body() body: CreatePaymentDto,
    @Req() req: Request & { user: JwtUser },
  ) {
    const result = await this.service.create(body, req.user);
    await this.auditService.record({
      user: req.user,
      action: 'payment.create',
      entity: 'payment',
      entity_id: result.payment.id,
      metadata: {
        customer_id: body.customer_id,
        invoice_id: body.invoice_id ?? null,
        amount: body.amount,
        mode: body.mode,
      },
    });
    return result;
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Admin, UserRole.Staff)
  @ApiCreatedResponse({
    description: 'KNET payment session created successfully.',
  })
  @Post('knet')
  async createKnetPayment(
    @Body() body: CreateKnetPaymentDto,
    @Req() req: Request & { user: JwtUser },
  ) {
    const result = await this.service.initiateKnetPayment(body, req.user);
    await this.auditService.record({
      user: req.user,
      action: 'knet.link.create',
      entity: 'knet_payment_session',
      entity_id: result.sessionId ?? null,
      metadata: {
        invoice_id: body.invoice_id,
        amount: body.amount,
        gateway_invoice_id: result.gatewayInvoiceId ?? null,
      },
    });
    return result;
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Admin, UserRole.Staff)
  @ApiCreatedResponse({
    description: 'Card payment session created successfully.',
  })
  @Post('card')
  async createCardPayment(
    @Body() body: CreateKnetPaymentDto,
    @Req() req: Request & { user: JwtUser },
  ) {
    const result = await this.service.initiateCardPayment(body, req.user);
    await this.auditService.record({
      user: req.user,
      action: 'card.link.create',
      entity: 'knet_payment_session',
      entity_id: result.sessionId ?? null,
      metadata: {
        invoice_id: body.invoice_id,
        amount: body.amount,
        gateway_invoice_id: result.gatewayInvoiceId ?? null,
      },
    });
    return result;
  }

  @ApiOkResponse({ description: 'Finalize a KNET payment after callback.' })
  @Get('knet/callback')
  @Header('Content-Type', 'text/html; charset=utf-8')
  async handleKnetCallback(
    @Query('PaymentId') paymentId?: string,
    @Query('paymentId') paymentIdLower?: string,
  ) {
    const resolvedPaymentId = paymentId || paymentIdLower;

    if (!resolvedPaymentId) {
      return this.renderCallbackPage({
        title: 'Payment Missing',
        message: 'MyFatoorah did not return a PaymentId.',
      });
    }

    try {
      const result = await this.service.finalizeKnetPayment(resolvedPaymentId);

      return this.renderCallbackPage({
        title: 'Payment Successful',
        message: `${result.message}. You can now return to the app.`,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Could not verify KNET payment';

      return this.renderCallbackPage({
        title: 'Payment Verification Failed',
        message,
      });
    }
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Admin)
  @ApiOkResponse({ description: 'KNET reconciliation summary.' })
  @Get('knet/reconciliation')
  getKnetReconciliation() {
    return this.service.getKnetReconciliation();
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Admin, UserRole.Staff)
  @ApiOkResponse({ description: 'KNET gateway availability.' })
  @Get('knet/availability')
  getKnetAvailability() {
    return this.service.getKnetAvailability();
  }

  @ApiOkResponse({ description: 'KNET payment failed or was cancelled.' })
  @Get('knet/error')
  @Header('Content-Type', 'text/html; charset=utf-8')
  async handleKnetError(@Query('PaymentId') paymentId?: string) {
    await this.service.markKnetFailure(
      paymentId,
      'The payment was cancelled or failed before completion.',
    );

    return this.renderCallbackPage({
      title: 'Payment Not Completed',
      message: paymentId
        ? `Payment ${paymentId} was cancelled or failed.`
        : 'The payment was cancelled or failed before completion.',
    });
  }

  @ApiOkResponse({ description: 'Mock KNET checkout for local testing.' })
  @Get('knet/mock-checkout')
  @Header('Content-Type', 'text/html; charset=utf-8')
  renderMockKnetCheckout(@Query('paymentId') paymentId?: string) {
    const safePaymentId = this.escapeHtml(paymentId ?? '');
    const callbackUrl = paymentId
      ? `/payments/knet/callback?paymentId=${encodeURIComponent(paymentId)}`
      : '/payments/knet/error';

    return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Mock KNET Checkout</title>
    <style>
      body {
        margin: 0;
        font-family: Arial, sans-serif;
        background: #f6f3ef;
        color: #1f2937;
      }
      main {
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: 24px;
      }
      section {
        width: min(440px, 100%);
        background: #ffffff;
        border-radius: 16px;
        padding: 24px;
        box-shadow: 0 12px 40px rgba(15, 23, 42, 0.08);
      }
      h1 {
        margin: 0 0 8px;
        font-size: 24px;
      }
      p {
        margin: 0 0 18px;
        line-height: 1.5;
      }
      code {
        display: block;
        margin-bottom: 18px;
        overflow-wrap: anywhere;
        border-radius: 10px;
        background: #f3f4f6;
        padding: 12px;
        font-size: 12px;
      }
      a {
        display: block;
        border-radius: 12px;
        background: #111827;
        color: #ffffff;
        padding: 14px 16px;
        text-align: center;
        text-decoration: none;
        font-weight: 700;
      }
    </style>
  </head>
  <body>
    <main>
      <section>
        <h1>Mock Online Checkout</h1>
        <p>This local test page simulates a successful debit or card payment.</p>
        <code>${safePaymentId || 'Missing payment id'}</code>
        <a href="${callbackUrl}">Approve Payment</a>
      </section>
    </main>
  </body>
</html>`;
  }

  @ApiOkResponse({ description: 'Get current status of a KNET payment.' })
  @Get('knet/status/:paymentId')
  getKnetStatus(@Param('paymentId') paymentId: string) {
    return this.service.getKnetPaymentStatus(paymentId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Admin, UserRole.Staff)
  @ApiOkResponse({ description: 'List all payments.' })
  @Get()
  findAll() {
    return this.service.findAll();
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Admin)
  @ApiOkResponse({ description: 'Reverse a recorded payment.' })
  @Post(':id/reverse')
  async reversePayment(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: ReversePaymentDto,
    @Req() req: Request & { user: JwtUser },
  ) {
    const result = await this.service.reversePayment(id, body, req.user);
    await this.auditService.record({
      user: req.user,
      action: 'payment.reverse',
      entity: 'payment',
      entity_id: id,
      metadata: {
        customer_id: result.payment.customer_id,
        invoice_id: result.payment.invoice_id ?? null,
        amount: result.payment.amount,
        reason: body.reason ?? null,
      },
    });
    return result;
  }

  private renderCallbackPage(params: { title: string; message: string }) {
    const title = this.escapeHtml(params.title);
    const message = this.escapeHtml(params.message);

    return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <style>
      body {
        margin: 0;
        font-family: Arial, sans-serif;
        background: #f4f7fb;
        color: #1f2937;
      }
      main {
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: 24px;
      }
      section {
        max-width: 420px;
        background: #ffffff;
        border-radius: 16px;
        padding: 24px;
        box-shadow: 0 12px 40px rgba(15, 23, 42, 0.08);
        text-align: center;
      }
      h1 {
        margin: 0 0 12px;
        font-size: 24px;
      }
      p {
        margin: 0;
        line-height: 1.5;
      }
    </style>
  </head>
  <body>
    <main>
      <section>
        <h1>${title}</h1>
        <p>${message}</p>
      </section>
    </main>
  </body>
</html>`;
  }

  private escapeHtml(value: string) {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }
}
