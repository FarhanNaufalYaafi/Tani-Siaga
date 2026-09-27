import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { FarmerGroupModule } from './farmer-group/farmer-group.module';
import { FarmlandsModule } from './farmlands/farmlands.module';
import { CommoditiesModule } from './commodities/commodities.module';
import { WilayahModule } from './wilayah/wilayah.module';
import { BmkgModule } from './bmkg/bmkg.module';
import { AiModule } from './ai/ai.module';
import { NotificationModule } from './notification/notification.module';
import { ScheduleModule } from '@nestjs/schedule';
import { BpsModule } from './bps/bps.module';
import { CartModule } from './mini e-commerce/cart/cart.module';
import { CartItemsModule } from './mini e-commerce/cart_items/cart_items.module';
import { ShopModule } from './mini e-commerce/shop/shop.module';
import { OrderModule } from './mini e-commerce/order/order.module';
import { OrderItemsModule } from './mini e-commerce/order_items/order_items.module';
import { ProductModule } from './mini e-commerce/product/product.module';

@Module({
  imports: [
      ScheduleModule.forRoot(),
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      type: 'postgres',
            host: 'localhost',
                  port: 5432,
                        username: 'postgres',
                              password: '17022010Farhan',
                                    database: 'tani_siaga',
                                          autoLoadEntities: true,
                                                synchronize: true,
                                                      logging: true
    }),
    AuthModule,
    PassportModule,
    JwtModule.register({
      global: true
    }),
    AuthModule,
    UserModule,
    PassportModule,
    JwtModule.register({ global: true }),
    FarmerGroupModule,
    FarmlandsModule,
    CommoditiesModule,
    WilayahModule,
    BmkgModule,
    AiModule,
    NotificationModule,
    BpsModule,
    CartModule,
    CartItemsModule,
    ProductModule,
    ShopModule,
    OrderModule,
    OrderItemsModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
