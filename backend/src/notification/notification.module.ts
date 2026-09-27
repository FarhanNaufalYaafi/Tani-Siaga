import { forwardRef, Module } from '@nestjs/common';
import { NotificationController } from './notification.controller';
import { BmkgModule } from 'src/bmkg/bmkg.module';
import { AiModule } from 'src/ai/ai.module';
import { FarmlandsModule } from 'src/farmlands/farmlands.module';
import { NotificationService } from './notification.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Farmland } from 'src/farmlands/entities/farmlands.entity';
import { UserDeviceToken } from 'src/user/entities/user-devices-token.entity';
import { InAppNotification } from './entities/in-app-notification.entity';
import { BookedOrder } from 'src/mini e-commerce/order/entities/booked-order.entity';
import { User } from 'src/user/entities/user.entity';

@Module({
  imports: [
    BmkgModule,
    forwardRef(() => AiModule),
    forwardRef(() => FarmlandsModule),
    TypeOrmModule.forFeature([Farmland, UserDeviceToken, InAppNotification, BookedOrder, User]),
  ],
  controllers: [NotificationController],
  providers: [NotificationService],
  exports: [NotificationService]
})
export class NotificationModule {}
