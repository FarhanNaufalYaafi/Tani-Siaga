import { Module } from '@nestjs/common';
import { FarmerGroupService } from './farmer-group.service';
import { FarmerGroupController } from './farmer-group.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FarmerGroup } from './entities/farmer-groups.entity';
import { FarmerGroupApplication } from './entities/farmer-group-application.entity';
import { UserService } from 'src/user/user.service';
import { UserModule } from 'src/user/user.module';
import { NotificationModule } from 'src/notification/notification.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([FarmerGroup, FarmerGroupApplication]),
    UserModule,
    NotificationModule,
  ],
  controllers: [FarmerGroupController],
  providers: [FarmerGroupService],
})
export class FarmerGroupModule {}
