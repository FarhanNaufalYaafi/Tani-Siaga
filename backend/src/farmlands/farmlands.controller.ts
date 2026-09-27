import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { FarmlandsService } from './farmlands.service';
import { CreateFarmlandDto } from './dtos/create-farmlands.dto';
import { RolesGuard } from 'src/auth/guards/role.guard';
import { userRoles } from 'src/user/enum/user-roles.enum';
import { JwtGuard } from 'src/auth/guards/jwt.guard';
import { Roles } from 'src/auth/decorator/role.decorator';
import { UpdateFarmlandDto } from './dtos/update-farmlands.dto';
import { BmkgService } from 'src/bmkg/bmkg.service';

@Controller('farmlands')
@Roles('admin')
export class FarmlandsController {
  constructor(
    private readonly farmlandsService: FarmlandsService,
    private readonly bmkgService: BmkgService
  ){}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('user', 'group_leader', 'individual_farmer')
  async create(@Req() req: any, @Body() dto: CreateFarmlandDto) {
    const userId = req.user.userId;
    return await this.farmlandsService.create(userId, dto);
  }

  @Get('my')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('user', 'farmer', 'individual_farmer', 'group_leader')
  async getMyFarmlands(
    @Req() req: any,
    @Query('page') page = '1',
    @Query('limit') limit = '8',
    @Query('search') search = '',
  ) {
    const userId = req.user.userId;
    return await this.farmlandsService.getAll(userId, Number(page), Number(limit), search);
  }

  @Get('group/:id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('user', 'farmer', 'group_leader')
  async getGroupFarmlands(
    @Param('id', ParseIntPipe) groupId: number,
    @Query('page') page = '1',
    @Query('limit') limit = '8',
    @Query('search') search = '',
  ) {
    return await this.farmlandsService.getGroupFarmlands(groupId, Number(page), Number(limit), search);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('user', 'farmer', 'individual_farmer', 'group_leader')
  async getFarmlandById(
    @Param('id', ParseIntPipe) farmlandId: number,
    @Req() req: any,
  ) {
    const userId = req.user.userId;
    return await this.farmlandsService.getOne(farmlandId, userId);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('individual_farmer', 'group_leader')
  async update(
    @Param('id', ParseIntPipe) farmlandId: number,
    @Req() req: any,
    @Body() dto: UpdateFarmlandDto,
  ) {
    const userId = req.user.userId;
    return await this.farmlandsService.update(farmlandId, userId, dto);
  }

  @Post(':id/replant')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('individual_farmer', 'group_leader')
  async replant(
    @Param('id', ParseIntPipe) farmlandId: number,
    @Req() req: any,
    @Body() dto: UpdateFarmlandDto,
  ) {
    return this.farmlandsService.replant(farmlandId, req.user.userId, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('group_leader', 'individual_farmer')
  async remove(
    @Param('id', ParseIntPipe) farmlandId: number,
    @Req() req: any,
  ) {
    const userId = req.user.userId;
    return await this.farmlandsService.remove(farmlandId, userId);
  }

  @Get(':id/weather')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('user', 'group_leader', 'individual_farmer', 'farmer')
  async getFarmlandWeather(
    @Param('id', ParseIntPipe) farmlandId: number,
    @Req() req: any,
  ) {
    const userId = req.user.userId

    const farmland = await this.farmlandsService.getOne(farmlandId, userId);

    if (farmland.status !== 'active') {
      throw new BadRequestException('Prakiraan BMKG dijeda untuk lahan yang sudah panen. Tanami kembali untuk mengaktifkannya.');
    }

    const adm4Code = farmland.adm4_code

    const forecasts = await this.bmkgService.getWeatherForecast(adm4Code);

    return {
      farmland_id: farmland.id,
      farmland_name: farmland.name,
      adm4_code: adm4Code,
      forecasts: forecasts,
    };
  }
}
