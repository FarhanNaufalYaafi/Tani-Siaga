import { Module } from '@nestjs/common';
import { ShopService } from './shop.service';
import { ShopController } from './shop.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductModule } from '../product/product.module';
import { UserModule } from 'src/user/user.module';
import { Shop } from './entities/shop.entity';
import { Product } from '../product/entities/product.entity';
import { OrderItems } from '../order_items/entities/order_items.entity';
import { NotificationModule } from 'src/notification/notification.module';
import { User } from 'src/user/entities/user.entity';
import { ProductReview } from '../product/entities/product-review.entity';

@Module({
  imports:[
    TypeOrmModule.forFeature([Shop, Product, OrderItems, ProductReview, User]),
    ProductModule,
    UserModule,
    NotificationModule,
  ],
  controllers: [ShopController],
  providers: [ShopService],
})
export class ShopModule {}
