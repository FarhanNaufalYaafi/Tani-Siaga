import {
  BadRequestException,
  Controller,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtGuard } from 'src/auth/guards/jwt.guard';
import { CloudinaryStorageService, ImagePurpose, UploadedImageFile } from './cloudinary-storage.service';

const ALLOWED_PURPOSES: ImagePurpose[] = ['product', 'profile', 'review', 'moderation'];

@Controller('media')
export class MediaController {
  constructor(private readonly storageService: CloudinaryStorageService) {}

  @Post('images')
  @UseGuards(JwtGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_request, file, callback) => {
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
          callback(new BadRequestException('Format gambar harus JPG, PNG, atau WebP.'), false);
          return;
        }
        callback(null, true);
      },
    }),
  )
  async uploadImage(
    @UploadedFile() file: UploadedImageFile | undefined,
    @Query('purpose') purpose: string,
    @Req() request: any,
  ) {
    if (!file) throw new BadRequestException('Pilih gambar yang akan diunggah.');
    if (!ALLOWED_PURPOSES.includes(purpose as ImagePurpose)) {
      throw new BadRequestException('Tujuan upload gambar tidak valid.');
    }
    if (purpose === 'moderation' && request.user.role !== 'admin') {
      throw new BadRequestException('Hanya admin yang dapat mengunggah foto bukti moderasi.');
    }
    return this.storageService.uploadImage(request.user.userId, purpose as ImagePurpose, file);
  }
}
