import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ShopService } from './shop.service';
import { JwtGuard } from 'src/auth/guards/jwt.guard';
import { CreateShopDto } from './dtos/create-shop.dto';
import { RolesGuard } from 'src/auth/guards/role.guard';
import { Roles } from 'src/auth/decorator/role.decorator';
import { ShopSanctionDto, ShopWarningDto } from './dtos/shop-moderation.dto';

@Controller('shop')
export class ShopController {
  constructor(private readonly shopService: ShopService) {}

  @Post()
  @UseGuards(JwtGuard)
  @HttpCode(HttpStatus.CREATED)
  async createShop(@Req() req: any, @Body() dto: CreateShopDto) {
    return await this.shopService.createShop(dto, req.user.userId);
  }

  @Get('me')
  @UseGuards(JwtGuard)
  async getMyShop(@Req() req: any) {
    const shop = await this.shopService.getMyShop(req.user.userId);
    return {
      message: shop ? 'Data toko berhasil dimuat' : 'User belum memiliki toko',
      has_shop: !!shop,
      shop,
    };
  }

  @Patch('me/profile-image')
  @UseGuards(JwtGuard)
  async updateMyShopProfileImage(@Req() req: any, @Body() dto: { profile_image_url: string }) {
    return this.shopService.updateMyShopProfileImage(req.user.userId, dto.profile_image_url);
  }

  @Get('me/products')
  @UseGuards(JwtGuard)
  async getMyShopProducts(@Req() req: any) {
    const products = await this.shopService.getMyShopProducts(req.user.userId);
    return {
      message: 'Daftar produk toko berhasil dimuat',
      data: products,
    };
  }

  @Get('admin/pending')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('admin')
  async getPendingShopsForAdmin(
    @Query('page') page = '1',
    @Query('limit') limit = '8',
    @Query('search') search = '',
  ) {
    return {
      message: 'Daftar toko menunggu persetujuan admin',
      ...(await this.shopService.getPendingShopsForAdmin(Number(page), Number(limit), search)),
    };
  }

  @Get('admin')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('admin')
  async getShopsForAdmin(
    @Query('page') page = '1',
    @Query('limit') limit = '8',
    @Query('search') search = '',
  ) {
    return {
      message: 'Daftar toko untuk admin',
      ...(await this.shopService.getShopsForAdmin(Number(page), Number(limit), search)),
    };
  }

  @Patch('admin/:id/approve')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('admin')
  async approveShop(@Param('id', ParseIntPipe) shopId: number) {
    return this.shopService.approveShop(shopId);
  }

  @Patch('admin/:id/reject')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('admin')
  async rejectShop(@Param('id', ParseIntPipe) shopId: number, @Body() dto: { reason?: string }) {
    return this.shopService.rejectShop(shopId, dto?.reason);
  }

  @Patch('admin/:id/warn')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('admin')
  async warnShop(@Param('id', ParseIntPipe) shopId: number, @Body() dto: ShopWarningDto) {
    return this.shopService.warnShop(shopId, dto.reason, dto.evidence_urls || []);
  }

  @Patch('admin/:id/ban')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('admin')
  async banShop(
    @Param('id', ParseIntPipe) shopId: number,
    @Body() dto: ShopSanctionDto,
  ) {
    return this.shopService.banShop(shopId, dto.reason, Number(dto.duration_days), dto.evidence_urls || []);
  }

  @Patch('admin/:id/lift-sanction')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('admin')
  async liftShopSanction(@Param('id', ParseIntPipe) shopId: number) {
    return this.shopService.liftShopSanction(shopId);
  }

  @Patch('admin/:id/reduce-sanction')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('admin')
  async reduceShopSanction(@Param('id', ParseIntPipe) shopId: number, @Body() dto: { days?: number }) {
    return this.shopService.reduceShopSanction(shopId, Number(dto?.days));
  }

  @Get('admin/:id/dashboard')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('admin')
  async getAdminShopDashboard(@Param('id', ParseIntPipe) shopId: number) {
    return {
      message: 'Dashboard toko berhasil dimuat',
      data: await this.shopService.getAdminShopDashboard(shopId),
    };
  }

  @Delete('admin/:id')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  async deleteShopByAdmin(@Param('id', ParseIntPipe) shopId: number) {
    return this.shopService.adminDeleteShop(shopId);
  }

  @Get(':id')
  async getPublicShop(@Param('id', ParseIntPipe) shopId: number) {
    return await this.shopService.getPublicShop(shopId);
  }
}
