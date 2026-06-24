import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import { AuditService } from '../audit/audit.service';
import { AppSettingService } from '../app-setting/app-setting.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../user/user-role.enum';
import type { JwtUser } from '../auth/jwt.strategy';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { VoidInvoiceDto } from './dto/void-invoice.dto';
import { generateInvoicePDF } from './pdf.service';
import { InvoiceService } from './invoice.service';

type DeliveryReceiptUpload = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

@ApiTags('invoices')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.Admin, UserRole.Staff)
@Controller('invoices')
export class InvoiceController {
  constructor(
    private service: InvoiceService,
    private auditService: AuditService,
    private appSettingService: AppSettingService,
  ) {}

  @ApiCreatedResponse({ description: 'Invoice created successfully.' })
  @Post()
  async create(
    @Body() body: CreateInvoiceDto,
    @Req() req: Request & { user: JwtUser },
  ) {
    const result = await this.service.create(body);
    await this.auditService.record({
      user: req.user,
      action: 'invoice.create',
      entity: 'invoice',
      entity_id: result.invoice.id,
      metadata: {
        customer_id: body.customer_id,
        total: result.invoice.total,
        item_count: body.items.length,
      },
    });
    return result;
  }

  @ApiOkResponse({ description: 'List all invoices.' })
  @Get()
  findAll() {
    return this.service.findAll();
  }

  @ApiOkResponse({ description: 'Dashboard summary.' })
  @Roles(UserRole.Admin)
  @Get('dashboard')
  getDashboard() {
    return this.service.getDashboard();
  }

  @ApiOkResponse({ description: 'Profit dashboard summary.' })
  @Roles(UserRole.Admin)
  @Get('profit')
  getProfit() {
    return this.service.getProfitDashboard();
  }

  @ApiOkResponse({ description: 'Daily, weekly, monthly, or yearly report.' })
  @Roles(UserRole.Admin)
  @Get('report')
  getReport(@Query('type') type: string) {
    return this.service.getReport(type);
  }

  @ApiOkResponse({ description: 'Historic all-in-one operational report.' })
  @Roles(UserRole.Admin)
  @Get('historic-report')
  getHistoricReport(@Query('from') from?: string, @Query('to') to?: string) {
    return this.service.getHistoricReport(from, to);
  }

  @ApiOkResponse({ description: 'Daily closing report.' })
  @Roles(UserRole.Admin)
  @Get('daily-close')
  getDailyClose(@Query('date') date?: string) {
    return this.service.getDailyClose(date);
  }

  @ApiOkResponse({ description: 'Download daily or weekly combined invoice PDF.' })
  @Get('consolidated/pdf')
  async getConsolidatedPDF(
    @Query('customer_id') customerId: string,
    @Query('period') period: string,
    @Query('date') date: string | undefined,
    @Query('currency') currency: string | undefined,
    @Query('payment_status') paymentStatus: string | undefined,
    @Res() res: Response,
  ) {
    const data = await this.service.getConsolidatedInvoicePdfData({
      customerId: Number(customerId),
      period,
      date,
      currency,
      paymentStatus,
    });

    return generateInvoicePDF(
      data.invoice,
      data.items,
      data.customer,
      data.productNames,
      res,
      undefined,
      data.itemDateLabels,
      data.itemStatusLabels,
    );
  }

  @ApiOkResponse({ description: 'Invoice detail with items, customer, and payments.' })
  @Get(':id')
  getInvoiceDetail(@Param('id', ParseIntPipe) id: number) {
    return this.service.getInvoiceDetail(id);
  }

  @ApiOkResponse({ description: 'Void invoice and reverse stock/ledger.' })
  @Roles(UserRole.Admin)
  @Post(':id/void')
  async voidInvoice(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: VoidInvoiceDto,
    @Req() req: Request & { user: JwtUser },
  ) {
    const result = await this.service.voidInvoice(id, body, req.user);
    await this.auditService.record({
      user: req.user,
      action: 'invoice.void',
      entity: 'invoice',
      entity_id: result.invoice.id,
      metadata: {
        customer_id: result.invoice.customer_id,
        total: result.invoice.total,
        reason: result.invoice.void_reason,
      },
    });
    return result;
  }

  @ApiOkResponse({ description: 'Download invoice PDF.' })
  @Get(':id/pdf')
  async getPDF(@Param('id') id: number, @Res() res: Response) {
    const invoice = await this.service.getInvoiceById(Number(id));
    const items = await this.service.getItemsByInvoice(Number(id));
    const customer = await this.service.getCustomer(invoice.customer_id);
    const productNames = await this.service.getProductNamesForItems(items);
    const currency = await this.appSettingService.getCurrencyRate();

    return generateInvoicePDF(
      this.service.withInvoiceNumber(invoice),
      items,
      customer,
      productNames,
      res,
      currency.kwd_to_usd_rate,
    );
  }

  @ApiCreatedResponse({ description: 'Delivery receipt uploaded.' })
  @Post(':id/delivery-receipt')
  @UseInterceptors(FileInterceptor('receipt'))
  async uploadDeliveryReceipt(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: DeliveryReceiptUpload | undefined,
    @Req() req: Request & { user: JwtUser },
  ) {
    const invoice = await this.service.uploadDeliveryReceipt(id, file);
    await this.auditService.record({
      user: req.user,
      action: 'invoice.delivery_receipt.upload',
      entity: 'invoice',
      entity_id: invoice.id,
      metadata: {
        customer_id: invoice.customer_id,
        delivery_receipt_original_name: invoice.delivery_receipt_original_name,
        delivery_receipt_mime_type: invoice.delivery_receipt_mime_type,
        delivery_receipt_size: invoice.delivery_receipt_size,
      },
    });
    return invoice;
  }

  @ApiOkResponse({ description: 'Download delivery receipt.' })
  @Get(':id/delivery-receipt')
  async getDeliveryReceipt(
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
  ) {
    const receipt = await this.service.getDeliveryReceiptFile(id);
    res.setHeader('Content-Type', receipt.mimeType);
    return res.download(receipt.path, receipt.originalName);
  }
}
