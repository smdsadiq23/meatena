import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { AppSettingService } from '../app-setting/app-setting.service';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../user/user-role.enum';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { generateSupplierStatementPDF } from './supplier-statement-pdf.service';
import { SupplierService } from './supplier.service';

@ApiTags('suppliers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.Admin)
@Controller('suppliers')
export class SupplierController {
  constructor(
    private readonly service: SupplierService,
    private readonly appSettingService: AppSettingService,
  ) {}

  @ApiCreatedResponse({ description: 'Supplier created successfully.' })
  @Post()
  create(@Body() body: CreateSupplierDto) {
    return this.service.create(body);
  }

  @ApiOkResponse({ description: 'List all suppliers.' })
  @Get()
  findAll() {
    return this.service.findAll();
  }

  @ApiOkResponse({ description: 'Supplier payable statement.' })
  @Get(':id/statement')
  getStatement(@Param('id', ParseIntPipe) id: number) {
    return this.service.getStatement(id);
  }

  @ApiOkResponse({ description: 'Download supplier payable statement PDF.' })
  @Get(':id/statement/pdf')
  @Header('Content-Type', 'application/pdf')
  async getStatementPdf(
    @Param('id', ParseIntPipe) id: number,
    @Query('currency') selectedCurrency: string | undefined,
    @Res() res: Response,
  ) {
    const data = await this.service.getStatement(id);
    const currency = await this.appSettingService.getCurrencyRate();
    generateSupplierStatementPDF(
      data.supplier,
      data.rows,
      data.totals,
      res,
      currency.kwd_to_usd_rate,
      selectedCurrency,
    );
  }

  @ApiOkResponse({ description: 'Supplier updated successfully.' })
  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() body: UpdateSupplierDto) {
    return this.service.update(id, body);
  }

  @ApiOkResponse({ description: 'Supplier deleted successfully.' })
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
