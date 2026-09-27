import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ShopService } from './shop.service';
import { JwtGuard } from 'src/auth/guards/jwt.guard';
import { CreateShopDto } from './dtos/create-shop.dto';

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

  @Get('me/products')
  @UseGuards(JwtGuard)
  async getMyShopProducts(@Req() req: any) {
    const products = await this.shopService.getMyShopProducts(req.user.userId);
    return {
      message: 'Daftar produk toko berhasil dimuat',
      data: products,
    };
  }

  @Get(':id')
  async getPublicShop(@Param('id', ParseIntPipe) shopId: number) {
    return await this.shopService.getPublicShop(shopId);
  }
}
