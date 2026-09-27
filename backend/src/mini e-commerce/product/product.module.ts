import { Module } from '@nestjs/common';
import { ProductController } from './product.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from './entities/product.entity';
import { ProductService } from './product.service';
import { UserModule } from 'src/user/user.module';
import { Farmland } from 'src/farmlands/entities/farmlands.entity';
import { AiRecommendation } from 'src/ai/entities/ai-recomendation.entity';
import { OrderModule } from '../order/order.module';

@Module({
  imports:[
    TypeOrmModule.forFeature([Product, Farmland, AiRecommendation]),
    OrderModule,
    UserModule
  ],
  controllers: [ProductController],
  providers: [ProductService],
  exports: [ProductService]
})
export class ProductModule {}
