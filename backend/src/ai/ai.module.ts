import { forwardRef, Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiRecommendation } from './entities/ai-recomendation.entity';
import { NotificationModule } from 'src/notification/notification.module';
import { Farmland } from 'src/farmlands/entities/farmlands.entity';
import { BmkgModule } from 'src/bmkg/bmkg.module';
import { HttpModule } from '@nestjs/axios';
import { MarketAnalysis } from './entities/market-analysis.entity';
import { BpsModule } from 'src/bps/bps.module';
// sekarang gw ingin ketika ada prediksi cuaca bmkg yang lalu diolah oleh ai yang mana itu per 1 lahan kan 3 jam sekali diperbarui. Nah itu gw ingin kalau misal masalah yang ditimbulkan sudah lumayan gawat misal harus apa lah ya intina bukan hijau deh. Maka gw ingin peringatan itu juga dikirim notifikasi petani yang memiliki lahan di area kabupaten / kota yang sama. Silahkan lihat data atau cari data berdasarkan adm4 code yang ada di setiap lahan lalu manfaatkan relasi lahan dengan user / farmer group untuk kirim notifikasi ke semua anggota grup jika lahan milik group dan kirim lokasi ke user jika itu hanya milik 1 user. Intinya setiap ai recomendation dan olah data bmkg serta market analysis itu kirim notifikasi ke semua anggota grup termasuk ketua. Kalau bukan lahan tani punya grup maka kirim peringatan ke user sendiri dan wilayah kabupaten / kota yang kemungkinan terdampak juga. Di notifikasi untuk para petani yang lahannya di kabupaten/kota tersebut tolong sampaikan juga di pesan notifikasi itu notifikasi dan info itu dari wilayah mana sampai tingkat level4 adm4 desa/kelurahan
@Module({
  imports: [
    TypeOrmModule.forFeature([AiRecommendation, Farmland, MarketAnalysis]),
    forwardRef(() => NotificationModule),
    BmkgModule,
    HttpModule,
    BpsModule
  ],
  controllers: [AiController],
  providers: [AiService],
  exports: [AiService]
})
export class AiModule {}
