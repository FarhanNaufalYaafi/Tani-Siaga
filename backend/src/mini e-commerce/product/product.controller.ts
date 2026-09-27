import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ProductService } from './product.service';
import { CreateProductDto } from './dtos/create-product.dto';
import { FulfillHarvestDto } from './dtos/fulfill-harvest.dto';
import { UpdateProductDto } from './dtos/update-product.dto';
import { JwtGuard } from 'src/auth/guards/jwt.guard';

@Controller('products')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Get()
  async getProducts(
    @Query('category') category: 'all' | 'pre_order' | 'ready_stock' = 'all',
    @Query('page') page = '1',
    @Query('limit') limit = '8',
    @Query('search') search = '',
  ) {
    return await this.productService.findCatalog(category, Number(page), Number(limit), search);
  }

  @Get(':id')
  async getProduct(@Param('id', ParseIntPipe) productId: number) {
    const product = await this.productService.findOneId(productId);
    return product;
  }

  @Post()
  @UseGuards(JwtGuard)
  async createProduct(@Body() dto: CreateProductDto, @Req() req: any) {
    return await this.productService.createProduct(dto, req.user.userId);
  }

  @Patch(':id')
  @UseGuards(JwtGuard)
  async updateProduct(
    @Param('id', ParseIntPipe) productId: number,
    @Body() dto: UpdateProductDto,
    @Req() req: any,
  ) {
    return await this.productService.updateProduct(productId, dto, req.user.userId);
  }

  @Delete(':id')
  @UseGuards(JwtGuard)
  @HttpCode(HttpStatus.OK)
  async deleteProduct(
    @Param('id', ParseIntPipe) productId: number,
    @Req() req: any,
  ) {
    return await this.productService.deleteProduct(productId, req.user.userId);
  }

  @Post(':id/complete-harvest')
  @UseGuards(JwtGuard)
  async completeHarvest(
    @Param('id', ParseIntPipe) productId: number,
    @Body() dto: FulfillHarvestDto,
    @Req() req: any,
  ) {
    return await this.productService.completeHarvestAndSetStock(productId, dto, req.user.userId);
  }

  @Post('farmlands/:farmlandId/complete-harvest')
  @UseGuards(JwtGuard)
  async completeFarmlandHarvest(
    @Param('farmlandId', ParseIntPipe) farmlandId: number,
    @Body() dto: FulfillHarvestDto,
    @Req() req: any,
  ) {
    return await this.productService.completeFarmlandHarvest(farmlandId, dto, req.user.userId);
  }
}