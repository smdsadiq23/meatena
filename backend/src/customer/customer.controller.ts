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
import { CreateCustomerDto } from './dto/create-customer.dto';
import { CustomerService } from './customer.service';
import { UpdateCustomerDto } from './dto/update-customer.dto';

@ApiTags('customers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.Admin, UserRole.Staff)
@Controller('customers')
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  @ApiCreatedResponse({ description: 'Customer created successfully.' })
  @Post()
  create(@Body() body: CreateCustomerDto) {
    return this.customerService.create(body);
  }

  @ApiOkResponse({ description: 'List all customers.' })
  @Get()
  findAll() {
    return this.customerService.findAll();
  }

  @ApiOkResponse({ description: 'Customer credit and outstanding summary.' })
  @Roles(UserRole.Admin)
  @Get('credit-summary')
  getCreditSummary() {
    return this.customerService.getCreditSummary();
  }

  @ApiOkResponse({
    description: 'Priority list for customer collection follow-up.',
  })
  @Get('collection-followups')
  getCollectionFollowups() {
    return this.customerService.getCollectionFollowups();
  }

  @ApiOkResponse({ description: 'Customer updated successfully.' })
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateCustomerDto,
  ) {
    return this.customerService.update(id, body);
  }

  @ApiOkResponse({ description: 'Customer deleted successfully.' })
  @Roles(UserRole.Admin)
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.customerService.remove(id);
  }
}
