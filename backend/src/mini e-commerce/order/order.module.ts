import { Module } from '@nestjs/common';
import { OrderService } from './order.service';
import { OrderController } from './order.controller';
import { Order } from './entities/order.entity';
import { BookedOrder } from './entities/booked-order.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserModule } from 'src/user/user.module';
import { Product } from '../product/entities/product.entity';
import { NotificationModule } from 'src/notification/notification.module';

@Module({
  imports:[
    TypeOrmModule.forFeature([Order, BookedOrder, Product]),
    UserModule,
    NotificationModule
  ],
  controllers: [OrderController],
  providers: [OrderService],
  exports: [OrderService],
})
export class OrderModule {}
