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
import { SupplierService } from './supplier.service';

@ApiTags('suppliers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.Admin)
@Controller('suppliers')
export class SupplierController {
  constructor(private readonly service: SupplierService) {}

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
