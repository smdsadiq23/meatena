import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
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
import { CreateSupplierPaymentDto } from './dto/create-supplier-payment.dto';
import { SupplierPaymentService } from './supplier-payment.service';

@ApiTags('supplier-payments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.Admin)
@Controller('supplier-payments')
export class SupplierPaymentController {
  constructor(
    private readonly service: SupplierPaymentService,
    private readonly auditService: AuditService,
  ) {}

  @ApiCreatedResponse({
    description: 'Supplier payment recorded successfully.',
  })
  @Post()
  async create(
    @Body() body: CreateSupplierPaymentDto,
    @Req() req: Request & { user: JwtUser },
  ) {
    const result = await this.service.create(body);
    await this.auditService.record({
      user: req.user,
      action: 'supplier_payment.create',
      entity: 'supplier_payment',
      entity_id: result.payment.id,
      metadata: {
        supplier_id: body.supplier_id,
        amount: body.amount,
        mode: body.mode,
      },
    });
    return result;
  }

  @ApiOkResponse({ description: 'List all supplier payments.' })
  @Get()
  findAll() {
    return this.service.findAll();
  }

  @ApiOkResponse({ description: 'List payments for one supplier.' })
  @Get('supplier/:supplierId')
  findBySupplier(@Param('supplierId', ParseIntPipe) supplierId: number) {
    return this.service.findBySupplier(supplierId);
  }
}
