import { BadRequestException, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { v2 as cloudinary } from 'cloudinary';
import { Readable } from 'stream';

export type ImagePurpose = 'product' | 'profile' | 'review' | 'moderation';
export interface UploadedImageFile {
  buffer: Buffer;
  mimetype: string;
  size: number;
}

const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

@Injectable()
export class CloudinaryStorageService {
  private readonly logger = new Logger(CloudinaryStorageService.name);

  async uploadImage(userId: number, purpose: ImagePurpose, file: UploadedImageFile) {
    const extension = ALLOWED_IMAGE_TYPES[file.mimetype];
    if (!extension) {
      throw new BadRequestException('Format gambar harus JPG, PNG, atau WebP.');
    }
    if (file.size > 5 * 1024 * 1024) {
      throw new BadRequestException('Ukuran gambar maksimal 5 MB.');
    }

    const credentials = {
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    };
    const missingConfig = Object.entries(credentials)
      .filter(([, value]) => !value)
      .map(([key]) => key);
    if (missingConfig.length) {
      throw new InternalServerErrorException(
        `Cloudinary belum dikonfigurasi pada backend. Variabel yang belum diatur: ${missingConfig.join(', ')}.`,
      );
    }

    cloudinary.config({ ...credentials, secure: true });

    try {
      const result = await new Promise<{ secure_url: string; public_id: string }>((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: `tani-siaga/users/${userId}/${purpose}`,
            public_id: randomUUID(),
            resource_type: 'image',
            format: extension,
            overwrite: false,
          },
          (error, uploaded) => {
            if (error) {
              reject(error);
            } else if (!uploaded) {
              reject(new Error('Cloudinary returned no upload result.'));
            } else {
              resolve({ secure_url: uploaded.secure_url, public_id: uploaded.public_id });
            }
          },
        );

        uploadStream.on('error', reject);
        Readable.from([file.buffer]).pipe(uploadStream);
      });

      return { url: result.secure_url, path: result.public_id };
    } catch (error) {
      this.logger.error(
        'Cloudinary image upload failed.',
        error instanceof Error ? error.stack : String(error),
      );
      throw new InternalServerErrorException(
        'Gagal mengunggah gambar ke Cloudinary. Periksa kredensial dan konfigurasi akun backend.',
      );
    }
  }
}
