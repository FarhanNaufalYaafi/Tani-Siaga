import { Body, Controller, Delete, HttpCode, Param, ParseIntPipe, Patch, Post, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { CartItemsService } from './cart_items.service';
import { JwtGuard } from 'src/auth/guards/jwt.guard';
import { CreateCartItemsDto } from './dtos/create.dto';
import { ProductService } from '../product/product.service';
import { CartService } from '../cart/cart.service';

@Controller('cart-items')
export class CartItemsController {
  constructor(
    private readonly cartItemsService: CartItemsService,
    private readonly cartService: CartService,
    private readonly prodService: ProductService
  ) {}

                                          
  @Post('/:productId')
  @HttpCode(200)
  @UseGuards(JwtGuard)
  async createCartItems(
    @Body() dto: CreateCartItemsDto,
    @Req() req,
    @Param('productId', ParseIntPipe) productId: number
  ){
    const product = await this.prodService.findOneId(productId)
    const userId = req.user.userId
    const cartId = await this.cartService.findCartIdByUserId(userId)
    const result = await this.cartItemsService.create(cartId, dto.quantity, productId)

    return {
      success: true,
      message: `success added ${product?.name} into your cart`,
      data: result
    }
  }

  @Patch('/:cartItemsId')
  @HttpCode(200)
  @UseGuards(JwtGuard)
  async updateCartItemQuantity(
    @Param('cartItemsId', ParseIntPipe) cartItemsId: number,
    @Body() dto: CreateCartItemsDto,
    @Req() req,
  ) {
    return {
      success: true,
      data: await this.cartItemsService.updateQuantity(cartItemsId, req.user.userId, dto.quantity),
    };
  }

  @Delete('/:cartItemsId')
  @HttpCode(200)
  @UseGuards(JwtGuard)
  async removeCartItems(
    @Param('cartItemsId', ParseIntPipe) cartItemsId: number,
    @Req() req
  ){
    const userId = req.user.userId
    if(!userId || userId === undefined || userId === null) throw new UnauthorizedException('try to login')
    const getProduct = await this.cartItemsService.findOne(cartItemsId)
    await this.cartItemsService.delete(cartItemsId, userId)

    return {
      success: true,
      message: `success delete ${getProduct!.product.name} from your cart`,
   }
  }
}

