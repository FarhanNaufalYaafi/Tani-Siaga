import { Module } from '@nestjs/common';
import { ProductController } from './product.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from './entities/product.entity';
import { ProductService } from './product.service';
import { UserModule } from 'src/user/user.module';
import { Farmland } from 'src/farmlands/entities/farmlands.entity';
import { AiRecommendation } from 'src/ai/entities/ai-recomendation.entity';
import { OrderModule } from '../order/order.module';
import { NotificationModule } from 'src/notification/notification.module';
import { User } from 'src/user/entities/user.entity';
import { ProductReview } from './entities/product-review.entity';
import { OrderItems } from '../order_items/entities/order_items.entity';

@Module({
  imports:[
    TypeOrmModule.forFeature([Product, Farmland, AiRecommendation, User, ProductReview, OrderItems]),
    OrderModule,
    UserModule,
    NotificationModule,
  ],
  controllers: [ProductController],
  providers: [ProductService],
  exports: [ProductService]
})
export class ProductModule {}
