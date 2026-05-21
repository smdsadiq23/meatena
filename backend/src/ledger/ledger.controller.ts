import { Controller, Get, Header, Param, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AppSettingService } from '../app-setting/app-setting.service';
import { UserRole } from '../user/user-role.enum';
import { LedgerService } from './ledger.service';
import { generateStatementPDF } from './statement-pdf.service';

@ApiTags('ledger')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.Admin, UserRole.Staff)
@Controller('ledger')
export class LedgerController {
  constructor(
    private service: LedgerService,
    private appSettingService: AppSettingService,
  ) {}

  @ApiOkResponse({ description: 'Get the current customer balance.' })
  @Get('balance/:customer_id')
  async getBalance(@Param('customer_id') customer_id: number) {
    const balance = await this.service.getBalance(Number(customer_id));
    return { customer_id, balance };
  }

  @ApiOkResponse({ description: 'Get the customer statement.' })
  @Get('statement/:customer_id')
  async getStatement(@Param('customer_id') customer_id: number) {
    return this.service.getStatement(Number(customer_id));
  }

  @ApiOkResponse({ description: 'Download the customer statement PDF.' })
  @Get('statement/:customer_id/pdf')
  @Header('Content-Type', 'application/pdf')
  async getStatementPdf(
    @Param('customer_id') customer_id: number,
    @Res() res: Response,
  ) {
    const data = await this.service.getStatementPdfData(Number(customer_id));
    const currency = await this.appSettingService.getCurrencyRate();
    generateStatementPDF(data.customer, data.rows, res, currency.kwd_to_usd_rate);
  }
}
