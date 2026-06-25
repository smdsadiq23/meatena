import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../user/user-role.enum';
import { CreateShipmentDto } from './dto/create-shipment.dto';
import { LinkShipmentRecordsDto } from './dto/link-shipment-records.dto';
import { UpdateShipmentDto } from './dto/update-shipment.dto';
import { ShipmentService } from './shipment.service';

@ApiTags('shipments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.Admin)
@Controller('shipments')
export class ShipmentController {
  constructor(private readonly service: ShipmentService) {}

  @Post()
  create(@Body() body: CreateShipmentDto) {
    return this.service.create(body);
  }

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @ApiOkResponse({ description: 'Shipment profit summaries.' })
  @Get('summary')
  summary(@Query('id') id?: string) {
    return this.service.summary(id ? Number(id) : undefined);
  }

  @Patch(':id/links')
  linkRecords(@Param('id') id: string, @Body() body: LinkShipmentRecordsDto) {
    return this.service.linkRecords(Number(id), body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: UpdateShipmentDto) {
    return this.service.update(Number(id), body);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.service.delete(Number(id));
  }
}
