import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, NotFoundException, Param, ParseIntPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ProductService } from './product.service';
import { CreateProductDto } from './dtos/create-product.dto';
import { FulfillHarvestDto } from './dtos/fulfill-harvest.dto';
import { UpdateProductDto } from './dtos/update-product.dto';
import { CreateProductReviewDto } from './dtos/create-product-review.dto';
import { UpdateProductReviewDto } from './dtos/update-product-review.dto';
import { JwtGuard } from 'src/auth/guards/jwt.guard';
import { RolesGuard } from 'src/auth/guards/role.guard';
import { Roles } from 'src/auth/decorator/role.decorator';

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

  @Get('admin/pending')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('admin')
  async getPendingProductsForAdmin(
    @Query('page') page = '1',
    @Query('limit') limit = '8',
    @Query('search') search = '',
  ) {
    return {
      message: 'Daftar produk menunggu persetujuan admin',
      ...(await this.productService.getPendingProductsForAdmin(Number(page), Number(limit), search)),
    };
  }

  @Patch('admin/:id/approve')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('admin')
  async approveProduct(@Param('id', ParseIntPipe) productId: number) {
    return this.productService.approveProduct(productId);
  }

  @Patch('admin/:id/reject')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('admin')
  async rejectProduct(@Param('id', ParseIntPipe) productId: number, @Body() dto: { reason?: string }) {
    return this.productService.rejectProduct(productId, dto?.reason);
  }

  @Patch('admin/:id/deactivate')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('admin')
  async deactivateProductByAdmin(@Param('id', ParseIntPipe) productId: number, @Body() dto: { reason?: string }) {
    return this.productService.adminDeactivateProduct(productId, dto?.reason);
  }

  @Patch('admin/:id/reactivate')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('admin')
  async reactivateProductByAdmin(@Param('id', ParseIntPipe) productId: number) {
    return this.productService.adminReactivateProduct(productId);
  }

  @Delete('admin/:id')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  async deleteProductByAdmin(@Param('id', ParseIntPipe) productId: number, @Body() dto: { reason?: string }) {
    return this.productService.adminDeleteProduct(productId, dto?.reason);
  }

  @Get(':id')
  async getProduct(@Param('id', ParseIntPipe) productId: number) {
    const product = await this.productService.findOneId(productId);
    if (!product || product.approval_status !== 'approved' || !product.is_active) {
      throw new NotFoundException('Produk tidak ditemukan atau belum disetujui.');
    }
    return product;
  }

  @Get(':id/reviews')
  async getProductReviews(
    @Param('id', ParseIntPipe) productId: number,
    @Query('page') page = '1',
    @Query('limit') limit = '10',
  ) {
    return this.productService.getProductReviews(productId, Number(page), Number(limit));
  }

  @UseGuards(JwtGuard)
  @Get(':id/reviews/eligibility')
  async getProductReviewEligibility(@Param('id', ParseIntPipe) productId: number, @Req() req: any) {
    return this.productService.getReviewEligibility(productId, req.user.userId);
  }

  @UseGuards(JwtGuard)
  @Post(':id/reviews')
  async createProductReview(
    @Param('id', ParseIntPipe) productId: number,
    @Body() dto: CreateProductReviewDto,
    @Req() req: any,
  ) {
    return this.productService.createProductReview(productId, req.user.userId, dto);
  }

  @UseGuards(JwtGuard)
  @Patch(':id/reviews/:reviewId')
  async updateProductReview(
    @Param('id', ParseIntPipe) productId: number,
    @Param('reviewId', ParseIntPipe) reviewId: number,
    @Body() dto: UpdateProductReviewDto,
    @Req() req: any,
  ) {
    return this.productService.updateProductReview(productId, reviewId, req.user.userId, dto, req.user.role);
  }

  @UseGuards(JwtGuard)
  @Delete(':id/reviews/:reviewId')
  @HttpCode(HttpStatus.OK)
  async deleteProductReview(
    @Param('id', ParseIntPipe) productId: number,
    @Param('reviewId', ParseIntPipe) reviewId: number,
    @Req() req: any,
  ) {
    return this.productService.deleteProductReview(productId, reviewId, req.user.userId, req.user.role);
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