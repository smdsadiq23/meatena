import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
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
import { CreateProductDto } from './dto/create-product.dto';
import { ProductService } from './product.service';

@ApiTags('products')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('products')
export class ProductController {
  constructor(private service: ProductService) {}

  @ApiCreatedResponse({ description: 'Product created successfully.' })
  @Roles(UserRole.Admin)
  @Post()
  create(@Body() body: CreateProductDto) {
    return this.service.create(body);
  }

  @ApiOkResponse({ description: 'List all products.' })
  @Roles(UserRole.Admin, UserRole.Staff)
  @Get()
  findAll() {
    return this.service.findAll();
  }

  @ApiOkResponse({
    description: 'List products at or below low-stock threshold.',
  })
  @Roles(UserRole.Admin, UserRole.Staff)
  @Get('low-stock')
  findLowStock() {
    return this.service.findLowStock();
  }

  @ApiOkResponse({ description: 'Product deleted successfully.' })
  @Roles(UserRole.Admin)
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
