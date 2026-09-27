import { forwardRef, Module } from '@nestjs/common';
import { FarmlandsService } from './farmlands.service';
import { FarmlandsController } from './farmlands.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Farmland } from './entities/farmlands.entity';
import { UserModule } from 'src/user/user.module';
import { BmkgModule } from 'src/bmkg/bmkg.module';
import { AiService } from 'src/ai/ai.service';
import { AiModule } from 'src/ai/ai.module';
import { NotificationModule } from 'src/notification/notification.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Farmland]),
    UserModule,
    BmkgModule,
    AiModule,
    forwardRef(() => NotificationModule),
  ],
  controllers: [FarmlandsController],
  providers: [FarmlandsService],
  exports: [FarmlandsService]
})
export class FarmlandsModule {}
