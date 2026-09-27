import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Like, Repository } from 'typeorm';
import { AiService } from 'src/ai/ai.service';
import { Farmland } from 'src/farmlands/entities/farmlands.entity';
import { UserDeviceToken } from 'src/user/entities/user-devices-token.entity';
import { InAppNotification, NotificationSeverity } from './entities/in-app-notification.entity';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import * as path from 'path';
import { BookedOrder } from 'src/mini e-commerce/order/entities/booked-order.entity';
import { bookedOrderStatus } from 'src/mini e-commerce/order/enum/booked-order-status.enum';
import { User } from 'src/user/entities/user.entity';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @InjectRepository(Farmland)
    private readonly farmlandRepo: Repository<Farmland>,
    private readonly aiService: AiService,
    @InjectRepository(UserDeviceToken) private readonly tokenRepo: Repository<UserDeviceToken>,
    @InjectRepository(InAppNotification) private readonly notificationRepo: Repository<InAppNotification>,
    @InjectRepository(BookedOrder) private readonly bookedOrderRepo: Repository<BookedOrder>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) {
    if (getApps().length === 0) {
  initializeApp({
    credential: cert(
      path.resolve(process.env.FIREBASE_CREDENTIAL_PATH || 'firebase-service-account.key.json')
    ),
  });
}
  }

    async sendPushNotificationToUser(userId: number, title: string, body: string, dataPayload?: any) {
      const tokens = await this.tokenRepo.find({ where: { userId } });
      
      if (!tokens || tokens.length === 0) {
        this.logger.warn(`[FCM] Tidak ada device token terdaftar untuk user ${userId}.`);
        return { totalTokens: 0, successCount: 0, failureCount: 0 };
      }

      const fcmTokens = tokens.map(t => t.fcmToken);

      const message = {
        notification: { title, body },
        data: dataPayload ? { ...dataPayload } : {},
        tokens: fcmTokens,
      };

      try {
        const response = await getMessaging().sendEachForMulticast(message);
        this.logger.log(`FCM terkirim: ${response.successCount} sukses, ${response.failureCount} gagal.`);
        const invalidTokenIds: number[] = [];
        response.responses.forEach((result, index) => {
          if (result.success) return;
          const code = result.error?.code || 'unknown';
          this.logger.warn(`[FCM] Push gagal untuk user ${userId}, token record ${tokens[index].id}: ${code}`);
          if (['messaging/registration-token-not-registered', 'messaging/invalid-registration-token'].includes(code)) {
            invalidTokenIds.push(tokens[index].id);
          }
        });
        if (invalidTokenIds.length) await this.tokenRepo.delete({ id: In(invalidTokenIds) });
        return {
          totalTokens: tokens.length,
          successCount: response.successCount,
          failureCount: response.failureCount,
        };
      } catch (error: any) {
        this.logger.error(`Gagal mengirim FCM: ${error.message}`);
        return { totalTokens: tokens.length, successCount: 0, failureCount: tokens.length };
      }
  }

  @Cron('0 */3 * * *')
  async handleEvery10MinutesWeatherCheck() {
    this.logger.log('Memulai pengecekan cuaca otomatis dan analisis AI untuk seluruh lahan...');

    try {
      // 1. Ambil semua data lahan yang terdaftar di database
      const farmlands = await this.farmlandRepo.find({
        where: { status: 'active' },
        relations: {
            commodity: true,
            user: true
        }, // Pastikan relasi ke commodity dan user terbawa
      });

      if (!farmlands || farmlands.length === 0) {
        this.logger.warn('Tidak ada lahan yang ditemukan untuk diproses.');
        return;
      }

      // 2. Looping setiap lahan secara independen
      for (const farmland of farmlands) {
  try {
    // 1. Panggil fungsi generate rekomendasi spesifik per lahan
    const recommendation = await this.aiService.generateAndSaveRecommendationForFarmland(farmland.id);

    const activeFarmland = await this.farmlandRepo.findOne({
      where: { id: farmland.id, status: 'active' },
      select: { id: true },
    });
    if (!activeFarmland) continue;

    this.logger.log(`[SUKSES] Rekomendasi berhasil dibuat untuk Lahan ID: ${farmland.id}`);

    await this.notifyFarmlandAudience(farmland, recommendation);
  } catch (error: any) {
    this.logger.error(`[GAGAL] Gagal memproses lahan ID ${farmland.id}: ${error.message}`);
  }
}

      this.logger.log('Selesai memproses seluruh lahan.');
    } catch (error: any) {
      this.logger.error(`Terjadi kesalahan pada cron job cuaca: ${error.message}`);
    }
  }

  async saveDeviceToken(userId: number, fcmToken: string, deviceType: string) {
    // 1. Cek apakah token FCM ini sudah pernah tersimpan
    let existingToken = await this.tokenRepo.findOne({ where: { fcmToken } });

    if (existingToken) {
      // Jika token sudah ada tapi milik user lain (misal ganti akun di HP yang sama), update userId-nya
      existingToken.userId = userId;
      existingToken.deviceType = deviceType;
      return await this.tokenRepo.save(existingToken);
    }

    // 2. Jika token baru, buat record baru
    const newToken = this.tokenRepo.create({
      userId,
      fcmToken,
      deviceType,
    });

    return await this.tokenRepo.save(newToken);
  }

  async removeDeviceToken(userId: number, fcmToken: string) {
    await this.tokenRepo.delete({ userId, fcmToken });
    return { message: 'Token notifikasi berhasil dinonaktifkan.' };
  }

  async createInAppNotification(input: {
    userId: number;
    title: string;
    message: string;
    type: string;
    severity?: NotificationSeverity;
    targetUrl?: string;
    metadata?: Record<string, string | number>;
  }) {
    const notification = this.notificationRepo.create({
      ...input,
      severity: input.severity || 'safe',
      targetUrl: input.targetUrl || null,
      metadata: input.metadata || null,
    });
    const saved = await this.notificationRepo.save(notification);
    await this.sendPushNotificationToUser(input.userId, input.title, input.message, {
      notificationId: String(saved.id),
      targetUrl: input.targetUrl || '',
    });
    return saved;
  }

  private async getFarmlandAudience(farmland: Farmland) {
    if (farmland.farmer_group_id) {
      const members = await this.userRepo.find({ where: { farmer_group_id: farmland.farmer_group_id }, select: { id: true } });
      return members.map((member) => member.id);
    }

    const adm3Code = farmland.adm4_code?.substring(0, 6);
    const nearbyFarmlands = await this.farmlandRepo.find({
      where: { adm4_code: Like(`${adm3Code}%`) },
      select: { user_id: true },
    });
    return [...new Set(nearbyFarmlands.map((nearby) => nearby.user_id).filter(Boolean))];
  }

  private async getAdm2FarmlandAudience(adm2Code: string) {
    const farmlands = await this.farmlandRepo
      .createQueryBuilder('farmland')
      .select(['farmland.user_id', 'farmland.farmer_group_id'])
      .where("REPLACE(farmland.adm4_code, '.', '') LIKE :adm2Prefix", { adm2Prefix: `${adm2Code}%` })
      .andWhere('farmland.status = :status', { status: 'active' })
      .getMany();
    const groupIds = [...new Set(farmlands.map((farmland) => farmland.farmer_group_id).filter(Boolean))];
    const groupMembers = groupIds.length
      ? await this.userRepo
          .createQueryBuilder('user')
          .where('user.farmer_group_id IN (:...groupIds)', { groupIds })
          .select(['user.id'])
          .getMany()
      : [];
    const userIds = new Set(farmlands.map((farmland) => farmland.user_id).filter(Boolean));
    groupMembers.forEach((member) => userIds.add(member.id));
    return [...userIds];
  }

  private async notifyFarmlandAudience(farmland: Farmland, recommendation: { id: number; summary: string; action_type: string }) {
    const isActionable = recommendation.action_type !== 'NORMAL';
    const adm2Code = farmland.adm4_code?.replace(/\D/g, '').slice(0, 4);
    const adm3Code = farmland.adm4_code?.substring(0, 6);
    const userIds = isActionable && adm2Code
      ? await this.getAdm2FarmlandAudience(adm2Code)
      : await this.getFarmlandAudience(farmland);
    const severity: NotificationSeverity = recommendation.action_type === 'NORMAL'
      ? 'safe'
      : ['PEST_ALERT', 'HEAT_ALERT'].includes(recommendation.action_type) ? 'danger' : 'warning';
    const area = isActionable
      ? `Kabupaten/kota terdampak (ADM2 ${adm2Code}), sumber ADM4 ${farmland.adm4_code}`
      : farmland.address_detail ? `sumber ADM4 ${farmland.adm4_code} (${farmland.address_detail}), cakupan ADM3 ${adm3Code}` : `sumber ADM4 ${farmland.adm4_code}, cakupan ADM3 ${adm3Code}`;

    for (const userId of userIds) {
      await this.createInAppNotification({
        userId,
        title: severity === 'safe' ? 'Pembaruan kondisi lahan' : 'Peringatan kondisi lahan',
        message: `${recommendation.summary || 'Rekomendasi baru tersedia'} Wilayah terdampak: ${area}.`,
        type: 'weather_recommendation',
        severity,
        targetUrl: isActionable ? '/lahan-tani' : `/lahan-tani/${farmland.id}`,
        metadata: { farmlandId: farmland.id, recommendationId: recommendation.id, adm2Code: adm2Code || '', adm3Code, adm4Code: farmland.adm4_code },
      });
    }
  }

  private async notifyProvinceMarketAudience(provinceCode: string, analyses: Array<{ commodity_name: string; price_trend: string; surplus_percentage: number }>) {
    const farmlands = await this.farmlandRepo.find({ where: { adm4_code: Like(`${provinceCode}%`), status: 'active' }, select: { user_id: true, farmer_group_id: true, adm4_code: true, address_detail: true } });
    const groupIds = [...new Set(farmlands.map((farmland) => farmland.farmer_group_id).filter(Boolean))];
    const groupMembers = groupIds.length ? await this.userRepo.createQueryBuilder('user').where('user.farmer_group_id IN (:...groupIds)', { groupIds }).select(['user.id']).getMany() : [];
    const userIds = new Set(farmlands.map((farmland) => farmland.user_id).filter(Boolean));
    groupMembers.forEach((member) => userIds.add(member.id));
    const adm4Codes = [...new Set(farmlands.map((farmland) => farmland.adm4_code))].join(', ');
    const summary = analyses.slice(0, 3).map((analysis) => `${analysis.commodity_name}: ${analysis.price_trend}`).join('; ');
    const severity: NotificationSeverity = analyses.some((analysis) => analysis.price_trend !== 'STABIL') ? 'warning' : 'safe';

    for (const userId of userIds) {
      await this.createInAppNotification({
        userId,
        title: 'Analisis pasar wilayah terbaru',
        message: `${summary || 'Analisis pasar terbaru tersedia.'} Wilayah ADM4 terdampak: ${adm4Codes || provinceCode}.`,
        type: 'market_analysis',
        severity,
        targetUrl: '/market-analysis',
        metadata: { provinceCode, adm4Codes },
      });
    }
  }

  async getInAppNotifications(userId: number) {
    const [data, unread] = await Promise.all([
      this.notificationRepo.find({ where: { userId }, order: { createdAt: 'DESC' } }),
      this.notificationRepo.count({ where: { userId, isRead: false } }),
    ]);
    return { data, unreadCount: unread };
  }

  async getInAppNotification(userId: number, notificationId: number) {
    const notification = await this.notificationRepo.findOne({ where: { id: notificationId, userId } });
    if (!notification) return null;
    return notification;
  }

  async markInAppNotificationRead(userId: number, notificationId: number) {
    await this.notificationRepo.update({ id: notificationId, userId }, { isRead: true });
    return this.getInAppNotification(userId, notificationId);
  }

  async markAllInAppNotificationsRead(userId: number) {
    const result = await this.notificationRepo.update({ userId, isRead: false }, { isRead: true });
    return { updatedCount: result.affected ?? 0 };
  }

  async deleteInAppNotification(userId: number, notificationId: number) {
    const result = await this.notificationRepo.delete({ id: notificationId, userId });
    return { deleted: (result.affected ?? 0) > 0 };
  }

  async deleteAllInAppNotifications(userId: number) {
    const result = await this.notificationRepo.delete({ userId });
    return { deletedCount: result.affected ?? 0 };
  }

  @Cron('0 8 * * *')
  async handleBookedOrderReminders() {
    const bookedOrders = await this.bookedOrderRepo.find({ where: { status: bookedOrderStatus.BOOKED }, relations: { product: true } });
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const bookedOrder of bookedOrders) {
      if (!bookedOrder.estimatedHarvestDate) continue;
      const harvestDate = new Date(bookedOrder.estimatedHarvestDate);
      harvestDate.setHours(0, 0, 0, 0);
      const daysUntilHarvest = Math.round((harvestDate.getTime() - today.getTime()) / 86400000);
      const reminderCode = [7, 3, 1, 0].includes(daysUntilHarvest) ? `h-${daysUntilHarvest}` : null;
      if (!reminderCode || bookedOrder.lastReminderCode === reminderCode) continue;

      const label = daysUntilHarvest === 0 ? 'hari ini' : `H-${daysUntilHarvest}`;
      await this.createInAppNotification({
        userId: bookedOrder.userId,
        title: `Panen ${label}: ${bookedOrder.product.name}`,
        message: `Pre-order Anda diperkirakan panen ${label}. Kami akan memberi kabar saat produk siap dikonfirmasi.`,
        type: 'preorder_reminder',
        severity: daysUntilHarvest <= 1 ? 'warning' : 'safe',
        targetUrl: '/pre-order',
        metadata: { bookedOrderId: bookedOrder.id, daysUntilHarvest },
      });
      bookedOrder.lastReminderCode = reminderCode;
      await this.bookedOrderRepo.save(bookedOrder);
    }
  }

  @Cron('0 6 */3 * *')
  async handleDailyMarketAnalysisCron() {
    this.logger.log('Memulai analisis pasar & tren harga provinsi setiap 3 hari...');

    // Ambil seluruh kode provinsi unik (2 digit awal ADM4)
    const rawProvinces = await this.farmlandRepo
      .createQueryBuilder('farmland')
      .select('DISTINCT SUBSTRING(farmland.adm4_code, 1, 2)', 'provCode')
      .where('farmland.adm4_code IS NOT NULL')
      .andWhere('farmland.status = :status', { status: 'active' })
      .getRawMany();

    for (const item of rawProvinces) {
      const provCode = item.provCode;
      if (!provCode) continue;

      try {
        this.logger.log(`[CronJob] Memproses analisis pasar untuk provinsi: ${provCode}`);

        // Jalankan analisis AI per provinsi
        const analyses = await this.aiService.generateMarketAnalysisForProvince(provCode);

        await this.notifyProvinceMarketAudience(provCode, analyses as Array<{ commodity_name: string; price_trend: string; surplus_percentage: number }>);

        // Kirim Notifikasi Broadcast per Provinsi (OPSIONAL)
        for (const data of analyses) {
          this.logger.log(
            `[Provinsi ${provCode}] Komoditas ${data.commodity_name}: ${data.price_trend} (Surplus: ${data.surplus_percentage}%)`,
          );
          // Panggil FCM push notification di sini jika ada
        }

        // 🛑 BERI JEDA 3 DETIK sebelum lanjut ke provinsi berikutnya
        // Mencegah API Gemini kebanjiran request (503 / 429)
        await delay(3000);

      } catch (error: any) {
        // 🛑 TRY-CATCH PER PROVINSI
        // Jika 1 provinsi gagal/error, log dicatat dan loop TETAP LANJUT ke provinsi berikutnya
        this.logger.error(
          `[CronJob] Gagal memproses analisis pasar provinsi ${provCode}: ${error.message}`,
        );
      }
    }

    this.logger.log('Selesai menjalankan analisis pasar & tren harga provinsi harian.');
  }
}
