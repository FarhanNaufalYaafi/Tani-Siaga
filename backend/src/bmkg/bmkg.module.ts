import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { CacheModule } from '@nestjs/cache-manager';
import { BmkgService } from './bmkg.service';
import { BmkgController } from './bmkg.controller';

@Module({
  imports: [
    HttpModule,
    CacheModule.register({
      ttl: 3600000,
      max: 200,
    }),
  ],
  controllers: [BmkgController],
  providers: [BmkgService],
  exports: [BmkgService]
})
export class BmkgModule {}