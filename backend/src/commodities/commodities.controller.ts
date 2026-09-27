import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
  Query,
} from '@nestjs/common';
import { CommoditiesService } from './commodities.service';
import { CreateCommodityDto } from './dtos/create-commodity.dto';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { UpdateCommodityDto } from './dtos/update-commdity.dto';
import { RolesGuard } from 'src/auth/guards/role.guard';
import { Roles } from 'src/auth/decorator/role.decorator';

@Controller('commodities')
@UseGuards(JwtGuard)
export class CommoditiesController {
  constructor(private readonly commoditiesService: CommoditiesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('admin', 'user', 'farmer', 'individual_farmer', 'group_leader')
  async create(@Body() dto: CreateCommodityDto) {
    return await this.commoditiesService.create(dto);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('admin', 'user', 'farmer', 'individual_farmer', 'group_leader')
  async findAll(
    @Query('page') page = '1',
    @Query('limit') limit = '8',
    @Query('search') search = '',
  ) {
    return await this.commoditiesService.findAll(Number(page), Number(limit), search);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('admin', 'user', 'farmer', 'individual_farmer', 'group_leader')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return await this.commoditiesService.findOne(id);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('admin')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCommodityDto,
  ) {
    return await this.commoditiesService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('admin')
  async remove(@Param('id', ParseIntPipe) id: number) {
    return await this.commoditiesService.remove(id);
  }
}