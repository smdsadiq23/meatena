import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../user/user-role.enum';
import { AppSettingService } from './app-setting.service';
import { UpdateCurrencyRateDto } from './dto/update-currency-rate.dto';

@ApiTags('settings')
@Controller('settings')
export class AppSettingController {
  constructor(private readonly service: AppSettingService) {}

  @ApiOkResponse({ description: 'Current KWD to USD display rate.' })
  @Get('currency-rate')
  getCurrencyRate() {
    return this.service.getCurrencyRate();
  }

  @ApiBearerAuth()
  @ApiOkResponse({ description: 'Update KWD to USD display rate.' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Admin)
  @Patch('currency-rate')
  updateCurrencyRate(@Body() body: UpdateCurrencyRateDto) {
    return this.service.setCurrencyRate(body.kwd_to_usd_rate);
  }
}
