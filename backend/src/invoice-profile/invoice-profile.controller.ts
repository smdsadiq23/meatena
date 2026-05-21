import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../user/user-role.enum';
import { SaveInvoiceProfileDto } from './dto/save-invoice-profile.dto';
import { InvoiceProfileService } from './invoice-profile.service';

@ApiTags('invoice-profiles')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('invoice-profiles')
export class InvoiceProfileController {
  constructor(private service: InvoiceProfileService) {}

  @ApiOkResponse({ description: 'List invoice profiles.' })
  @Roles(UserRole.Admin, UserRole.Staff)
  @Get()
  findAll() {
    return this.service.findAll();
  }

  @ApiOkResponse({ description: 'Get default invoice profile.' })
  @Roles(UserRole.Admin, UserRole.Staff)
  @Get('default')
  getDefault() {
    return this.service.getDefault();
  }

  @ApiCreatedResponse({ description: 'Invoice profile created.' })
  @Roles(UserRole.Admin)
  @Post()
  create(@Body() body: SaveInvoiceProfileDto) {
    return this.service.create(body);
  }

  @ApiOkResponse({ description: 'Invoice profile updated.' })
  @Roles(UserRole.Admin)
  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() body: SaveInvoiceProfileDto) {
    return this.service.update(id, body);
  }

  @ApiOkResponse({ description: 'Invoice profile selected as default.' })
  @Roles(UserRole.Admin)
  @Post(':id/default')
  setDefault(@Param('id', ParseIntPipe) id: number) {
    return this.service.setDefault(id);
  }

  @ApiOkResponse({ description: 'Invoice profile deleted.' })
  @Roles(UserRole.Admin)
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
