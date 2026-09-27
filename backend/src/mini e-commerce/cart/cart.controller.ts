import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { CartService } from './cart.service';
import { JwtGuard } from 'src/auth/guards/jwt.guard';

@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  @UseGuards(JwtGuard)
  async getCartAndItems(
    @Req() req
  ){
    const userId = req.user.userId
    return await this.cartService.getCartAndItems(userId)
  }
}
