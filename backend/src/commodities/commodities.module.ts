import { Module } from '@nestjs/common';
import { CommoditiesService } from './commodities.service';
import { CommoditiesController } from './commodities.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Commodity } from './entities/commodity.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Commodity])
  ],
  controllers: [CommoditiesController],
  providers: [CommoditiesService],
})
export class CommoditiesModule {}
