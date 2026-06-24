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
import { CreateStockAdjustmentDto } from './dto/create-stock-adjustment.dto';
import { ReverseStockMovementDto } from './dto/reverse-stock-movement.dto';
import { InventoryService } from './inventory.service';

@ApiTags('inventory')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('inventory')
export class InventoryController {
  constructor(
    private readonly service: InventoryService,
    private readonly auditService: AuditService,
  ) {}

  @ApiOkResponse({ description: 'Current stock balances.' })
  @Roles(UserRole.Admin, UserRole.Staff)
  @Get('stock')
  listStock() {
    return this.service.listStock();
  }

  @ApiOkResponse({ description: 'Inventory summary and low-stock alerts.' })
  @Roles(UserRole.Admin, UserRole.Staff)
  @Get('summary')
  getSummary() {
    return this.service.getSummary();
  }

  @ApiOkResponse({ description: 'Low-stock reorder suggestions.' })
  @Roles(UserRole.Admin, UserRole.Staff)
  @Get('reorder-suggestions')
  getReorderSuggestions() {
    return this.service.getReorderSuggestions();
  }

  @ApiOkResponse({ description: 'Stock movement history.' })
  @Roles(UserRole.Admin, UserRole.Staff)
  @Get('movements')
  listMovements() {
    return this.service.listMovements();
  }

  @ApiCreatedResponse({ description: 'Stock adjustment recorded.' })
  @Roles(UserRole.Admin)
  @Post('adjustments')
  async adjustStock(
    @Body() body: CreateStockAdjustmentDto,
    @Req() req: Request & { user: JwtUser },
  ) {
    const result = await this.service.adjustStock(body);
    await this.auditService.record({
      user: req.user,
      action: 'inventory.adjust',
      entity: 'stock_movement',
      entity_id: result.id,
      metadata: {
        product_id: body.product_id,
        type: body.type,
        quantity_kg: body.quantity_kg,
      },
    });
    return result;
  }

  @ApiCreatedResponse({ description: 'Stock movement reversed with an audit correction.' })
  @Roles(UserRole.Admin)
  @Post('movements/:id/reverse')
  async reverseMovement(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: ReverseStockMovementDto,
    @Req() req: Request & { user: JwtUser },
  ) {
    const result = await this.service.reverseMovement(id, body.reason);
    await this.auditService.record({
      user: req.user,
      action: 'inventory.reverse_movement',
      entity: 'stock_movement',
      entity_id: id,
      metadata: {
        reversal_id: result.id,
        reason: body.reason,
      },
    });
    return result;
  }
}
