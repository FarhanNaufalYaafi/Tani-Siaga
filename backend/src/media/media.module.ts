import { Module } from '@nestjs/common';
import { MediaController } from './media.controller';
import { CloudinaryStorageService } from './cloudinary-storage.service';

@Module({
  controllers: [MediaController],
  providers: [CloudinaryStorageService],
})
export class MediaModule {}
