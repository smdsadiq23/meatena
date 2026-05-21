import {
  Body,
  Controller,
  Get,
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
import type { JwtUser } from '../auth/jwt.strategy';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../user/user-role.enum';
import { CreateShiftCloseDto } from './dto/create-shift-close.dto';
import { ReviewShiftCloseDto } from './dto/review-shift-close.dto';
import { ShiftCloseService } from './shift-close.service';

@ApiTags('shift-close')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.Admin, UserRole.Staff)
@Controller('shift-close')
export class ShiftCloseController {
  constructor(
    private readonly service: ShiftCloseService,
    private readonly auditService: AuditService,
  ) {}

  @ApiOkResponse({ description: 'Shift close summary for the selected date.' })
  @Get('summary')
  getSummary(
    @Query('date') date: string | undefined,
    @Query('user_id') userId: string | undefined,
    @Req() req: Request & { user: JwtUser },
  ) {
    const parsedUserId = userId ? Number(userId) : undefined;
    return this.service.getSummary(date, req.user, parsedUserId);
  }

  @ApiCreatedResponse({ description: 'Shift close submitted.' })
  @Post()
  async submit(
    @Body() body: CreateShiftCloseDto,
    @Req() req: Request & { user: JwtUser },
  ) {
    const close = await this.service.submit(body, req.user);
    await this.auditService.record({
      user: req.user,
      action: 'shift_close.submit',
      entity: 'shift_close',
      entity_id: close.id,
      metadata: {
        date: close.date,
        system_total: close.system_total,
        counted_total: close.counted_total,
        variance_total: close.variance_total,
      },
    });
    return close;
  }

  @ApiOkResponse({ description: 'List submitted shift closes.' })
  @Get()
  findAll(@Req() req: Request & { user: JwtUser }) {
    return this.service.findAll(req.user);
  }

  @ApiOkResponse({ description: 'Mark a shift close as reviewed.' })
  @Roles(UserRole.Admin)
  @Post(':id/review')
  async review(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: ReviewShiftCloseDto,
    @Req() req: Request & { user: JwtUser },
  ) {
    const close = await this.service.review(id, body, req.user);
    await this.auditService.record({
      user: req.user,
      action: 'shift_close.review',
      entity: 'shift_close',
      entity_id: close.id,
      metadata: {
        date: close.date,
        user_id: close.user_id,
        variance_total: close.variance_total,
      },
    });
    return close;
  }
}
