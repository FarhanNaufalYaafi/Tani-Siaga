import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Req,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  Query,
} from '@nestjs/common';
import { OrderService } from './order.service';
import { CreateOrderDto } from './dtos/create-order.dto';
import { JwtGuard } from 'src/auth/guards/jwt.guard';

@Controller(['orders', 'order'])
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

                                                                       
  @UseGuards(JwtGuard)
  @Post('review/:cartItemId')
  async reviewOrder(
    @Req() req: any,
    @Param('cartItemId', ParseIntPipe) cartItemId: number,
  ) {
    return await this.orderService.reviewOrder(req.user.userId, cartItemId);
  }

                                                                                                               
  @UseGuards(JwtGuard)
  @Post('payment/:cartItemId')
  async payment(
    @Req() req: any,
    @Param('cartItemId', ParseIntPipe) cartItemId: number,
    @Body() dto: CreateOrderDto,
  ) {
    return await this.orderService.payment(req.user.userId, cartItemId, dto);
  }

                                                                                     
  @UseGuards(JwtGuard)
  @Get()
  async getAllUserOrders(@Req() req: any) {
    return await this.orderService.getAllUserOrders(req.user.userId);
  }

  @UseGuards(JwtGuard)
  @Get('seller')
  async getSellerOrders(@Req() req: any) {
    return await this.orderService.getSellerOrders(req.user.userId);
  }

  @UseGuards(JwtGuard)
  @Get('booked')
  async getBookedOrders(@Req() req: any) {
    return await this.orderService.getBookedOrders(req.user.userId);
  }

  @UseGuards(JwtGuard)
  @Post('booked/:id/cancel')
  async cancelBookedOrder(@Req() req: any, @Param('id', ParseIntPipe) bookedOrderId: number) {
    return await this.orderService.cancelBookedOrder(req.user.userId, bookedOrderId);
  }

  @UseGuards(JwtGuard)
  @Post('booked/:id/confirm')
  async confirmBookedOrder(@Req() req: any, @Param('id', ParseIntPipe) bookedOrderId: number) {
    return await this.orderService.confirmBookedOrder(req.user.userId, bookedOrderId);
  }

  @UseGuards(JwtGuard)
  @Get('seller/manage')
  async getSellerOrdersWithConfirmation(
    @Req() req: any,
    @Query('filter') filter: 'all' | 'seller_waiting_payment' | 'seller_pending' | 'seller_unconfirmed' | 'seller_cancelled' | 'seller_completed' = 'all',
  ) {
    return await this.orderService.getSellerOrdersManage(req.user.userId, filter);
  }

                                                                                                 
  @UseGuards(JwtGuard)
  @Get(':id')
  async getOrderDetail(
    @Req() req: any,
    @Param('id', ParseIntPipe) orderId: number,
  ) {
    return await this.orderService.getOrderDetail(req.user.userId, orderId);
  }

  @UseGuards(JwtGuard)
  @Post(':id/confirm')
  async confirmOrder(
    @Req() req: any,
    @Param('id', ParseIntPipe) orderId: number,
  ) {
    return await this.orderService.confirmOrder(req.user.userId, orderId);
  }

  @UseGuards(JwtGuard)
  @Post(':id/sync')
  @HttpCode(HttpStatus.OK)
  async manualSyncOrder(
    @Param('id', ParseIntPipe) orderId: number,
  ) {
    return await this.orderService.manualSyncOrderById(orderId);
  }

                                                                                                 
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(@Body() notificationDto: any) {
    return await this.orderService.handleWebhook(notificationDto);
  }

  @UseGuards(JwtGuard)
  @Post('replay-webhook')
  @HttpCode(HttpStatus.OK)
  async manualReplayWebhook(@Body() notificationDto: any) {
    return await this.orderService.handleWebhook(notificationDto);
  }
}