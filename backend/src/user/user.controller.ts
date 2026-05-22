import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
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
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { JwtUser } from '../auth/jwt.strategy';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserService } from './user.service';
import { UserRole } from './user-role.enum';
import type { Request } from 'express';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.Admin)
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @ApiCreatedResponse({ description: 'User created successfully.' })
  @Post()
  create(@Body() body: CreateUserDto) {
    return this.userService.create(body);
  }

  @ApiOkResponse({ description: 'List all users.' })
  @Get()
  findAll() {
    return this.userService.findAll();
  }

  @ApiOkResponse({ description: 'Update a user account.' })
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateUserDto,
    @Req() req: Request & { user: JwtUser },
  ) {
    return this.userService.update(id, body, req.user);
  }

  @ApiOkResponse({ description: 'Delete a user account.' })
  @Delete(':id')
  remove(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request & { user: JwtUser },
  ) {
    return this.userService.remove(id, req.user);
  }
}
