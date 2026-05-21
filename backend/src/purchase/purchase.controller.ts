import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
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
import type { Request } from 'express';
import { AuditService } from '../audit/audit.service';
import { AppSettingService } from '../app-setting/app-setting.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../user/user-role.enum';
import type { JwtUser } from '../auth/jwt.strategy';
import type { Response } from 'express';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { generatePurchasePDF } from './purchase-pdf.service';
import { PurchaseService } from './purchase.service';

type ReceiptUpload = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

@ApiTags('purchases')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.Admin)
@Controller('purchases')
export class PurchaseController {
  constructor(
    private readonly service: PurchaseService,
    private readonly auditService: AuditService,
    private readonly appSettingService: AppSettingService,
  ) {}

  @ApiCreatedResponse({ description: 'Purchase recorded successfully.' })
  @Post()
  async create(
    @Body() body: CreatePurchaseDto,
    @Req() req: Request & { user: JwtUser },
  ) {
    const result = await this.service.create(body);
    await this.auditService.record({
      user: req.user,
      action: 'purchase.create',
      entity: 'purchase',
      entity_id: result.purchase.id,
      metadata: {
        supplier_id: body.supplier_id,
        total: result.purchase.total,
        item_count: body.items.length,
      },
    });
    return result;
  }

  @ApiOkResponse({ description: 'List all purchases.' })
  @Get()
  findAll() {
    return this.service.findAll();
  }

  @ApiCreatedResponse({ description: 'Delivery receipt uploaded.' })
  @Post(':id/receipt')
  @UseInterceptors(FileInterceptor('receipt'))
  async uploadReceipt(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: ReceiptUpload | undefined,
    @Req() req: Request & { user: JwtUser },
  ) {
    const purchase = await this.service.uploadReceipt(id, file);
    await this.auditService.record({
      user: req.user,
      action: 'purchase.receipt.upload',
      entity: 'purchase',
      entity_id: purchase.id,
      metadata: {
        receipt_original_name: purchase.receipt_original_name,
        receipt_mime_type: purchase.receipt_mime_type,
        receipt_size: purchase.receipt_size,
      },
    });
    return purchase;
  }

  @ApiOkResponse({ description: 'Download delivery receipt.' })
  @Get(':id/receipt')
  async getReceipt(
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
  ) {
    const receipt = await this.service.getReceiptFile(id);
    res.setHeader('Content-Type', receipt.mimeType);
    return res.download(receipt.path, receipt.originalName);
  }

  @ApiOkResponse({ description: 'Download purchase PDF.' })
  @Get(':id/pdf')
  async getPDF(@Param('id', ParseIntPipe) id: number, @Res() res: Response) {
    const purchase = await this.service.getPurchaseById(id);
    const items = await this.service.getItemsByPurchase(id);
    const supplier = await this.service.getSupplier(purchase.supplier_id);
    const products = await this.service.getProductsByIds(
      items.map((item) => item.product_id),
    );
    const currency = await this.appSettingService.getCurrencyRate();

    return generatePurchasePDF(
      purchase,
      items,
      supplier,
      products,
      res,
      currency.kwd_to_usd_rate,
    );
  }
}
