import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, In, MoreThanOrEqual, Repository } from 'typeorm';
import { GoogleGenAI, Type } from '@google/genai';
import { BmkgService, WeatherForecast } from '../bmkg/bmkg.service';
import { BpsService } from '../bps/bps.service';                     
import { AiRecommendation } from './entities/ai-recomendation.entity';
import { Farmland } from 'src/farmlands/entities/farmlands.entity';
import { MarketAnalysis } from './entities/market-analysis.entity';
import { QueryHistoryDto } from './dtos/query-history.dto';

export interface WeatherAiAnalysis {
  summary: string;
  detailed_advice: string;
  step_by_step_steps: string[];
  action_type: 'NORMAL' | 'IRRIGATE' | 'STOP_FERTILIZER' | 'PEST_ALERT' | 'DRAINAGE' | 'HEAT_ALERT';
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly ai: GoogleGenAI;

  constructor(
    @InjectRepository(AiRecommendation)
    private readonly aiRepo: Repository<AiRecommendation>,
    @InjectRepository(Farmland)
    private readonly farmlandRepo: Repository<Farmland>,                              
    @InjectRepository(MarketAnalysis)
    private readonly marketAnalysisRepo: Repository<MarketAnalysis>,                                    
    private readonly bmkgService: BmkgService,                      
    private readonly bpsService: BpsService,                     
  ) {
                                                              
    this.ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY || '',
    });
  }

                                                                              
                                                                              
                                                                              

  private getEffectiveCommodityParams(farmland: Farmland) {
    const baseCommodity = farmland.commodity;

    return {
      commodity_name: baseCommodity?.name ?? 'Tanaman Tidak Diketahui',
      variety: baseCommodity?.variety ?? null,
      max_temp_celsius: farmland.custom_max_temp_celsius ?? baseCommodity?.max_temp_celsius ?? 0,
      min_temp_celsius: farmland.custom_min_temp_celsius ?? baseCommodity?.min_temp_celsius ?? 0,
      max_humidity_percentage: farmland.custom_max_humidity_percentage ?? baseCommodity?.max_humidity_percentage ?? 0,
    };
  }

                                                                                           
  async generateAndSaveRecommendationForFarmland(farmlandId: number): Promise<AiRecommendation> {
    const farmland = await this.farmlandRepo.findOne({
      where: { id: farmlandId },
      relations: {
        commodity: true,
      },
    });

    if (!farmland) {
      throw new NotFoundException(`Lahan dengan ID ${farmlandId} tidak ditemukan.`);
    }

    if (farmland.status !== 'active') {
      throw new BadRequestException('Analisis cuaca dan rekomendasi dinonaktifkan sementara untuk lahan yang sudah panen.');
    }

    if (!farmland.adm4_code) {
      throw new Error(`Lahan "${farmland.name}" tidak memiliki kode ADM4 yang valid.`);
    }

    // 1. Ambil data cuaca dari BMKG menggunakan adm4_code milik lahan
    const forecasts = await this.bmkgService.getWeatherForecast(farmland.adm4_code);

    // 2. Generate analisis menggunakan Gemini AI
    const analysis = await this.generateRecommendation(farmland, forecasts);

    const activeFarmland = await this.farmlandRepo.findOne({
      where: { id: farmlandId, status: 'active' },
      select: { id: true },
    });
    if (!activeFarmland) {
      throw new BadRequestException('Lahan sudah panen saat analisis diproses. Rekomendasi tidak disimpan.');
    }

    // 3. Simpan hasilnya ke database
    return await this.saveRecommendation(farmland, analysis, forecasts);
  }

  async generateRecommendation(
    farmland: Farmland,
    forecasts: WeatherForecast[],
  ): Promise<WeatherAiAnalysis> {
    const upcomingForecasts = forecasts.slice(0, 2);
    const effectiveParams = this.getEffectiveCommodityParams(farmland);

    let plantAgeInDays = 0;
    if (farmland.plant_date) {
      const now = new Date();
      const plantDate = new Date(farmland.plant_date);
      const diffTime = Math.abs(now.getTime() - plantDate.getTime());
      plantAgeInDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    const weatherSummaryContext = upcomingForecasts.map((f) => ({
      waktu: f.datetime,
      kondisi: f.weather_name,
      suhu_celsius: f.temperature,
      kelembapan_persen: f.humidity,
      curah_hujan_tp: f.precipitation,
      kecepatan_angin_kmh: f.wind_speed,
    }));

    const prompt = `
Kamu adalah Pakar Agronomi Senior dan Konsultan Pertanian Presisi Indonesia yang ramah, informatif, dan sangat detail.
Berikan rekomendasi aksi terbaik beserta panduan praktis yang komprehensif, panjang, dan jelas untuk petani berdasarkan data lahan berikut:

- Nama Lahan: ${farmland.name}
- Komoditas: ${effectiveParams.commodity_name}${effectiveParams.variety ? ` (Varietas: ${effectiveParams.variety})` : ''}
- Metode Tanam: ${farmland.plant_method || 'Konvensional'}
- Umur Tanaman: ${plantAgeInDays > 0 ? `${plantAgeInDays} HST (Hari Setelah Tanam)` : 'Tidak terdata'}
- Batas Parameter Lahan:
  * Max Suhu: ${effectiveParams.max_temp_celsius} °C
  * Min Suhu: ${effectiveParams.min_temp_celsius} °C
- Prakiraan Cuaca 3-6 Jam Ke Depan: ${JSON.stringify(weatherSummaryContext)}

TUGAS UTAMA:
Pilih 1 rekomendasi aksi terbaik. Berikan penjelasan yang **panjang, mendalam, dan komprehensif** mencakup analisis kondisi cuaca, kondisi fisiologis tanaman pada umur tersebut, serta alasan ilmiah mengapa tindakan ini harus segera diambil.

PENTING: Jawab HANYA dalam format JSON valid tanpa tambahan teks lain atau markdown block (tanpa \`\`\`json):
{
  "summary": "1 kalimat ringkas beraksi cepat (maksimal 12 kata) untuk judul notifikasi",
  "detailed_advice": "Paragraf penjelasan yang komprehensif, panjang, dan mendalam (minimal 4-5 kalimat) mencakup analisis cuaca, kondisi tanah, dan fisiologis tanaman secara detail.",
  "step_by_step_steps": [
    "Langkah 1: [Penjelasan instruksi teknis yang sangat operasional dan jelas]",
    "Langkah 2: [Penjelasan instruksi teknis yang sangat operasional dan jelas]",
    "Langkah 3: [Penjelasan instruksi teknis yang sangat operasional dan jelas]"
  ],
  "action_type": "NORMAL | IRRIGATE | STOP_FERTILIZER | PEST_ALERT | DRAINAGE | HEAT_ALERT"
}
`;

    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: prompt,
      });

      const responseText = response.text?.trim() || '';

      const cleanedJsonStr = responseText
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();

      const parsedAnalysis: WeatherAiAnalysis = JSON.parse(cleanedJsonStr);
      return parsedAnalysis;

    } catch (error: any) {
      this.logger.error(`Gagal koneksi/parsing Gemini AI: ${error.message}. Menggunakan fallback.`);
      return this.generateFallbackRecommendation(farmland, upcomingForecasts[0]);
    }
  }

  async saveRecommendation(
    farmland: Farmland,
    analysis: WeatherAiAnalysis,
    weatherSnapshot: WeatherForecast[],
  ): Promise<AiRecommendation> {
    const recommendation = this.aiRepo.create({
      farmlandId: farmland.id,
      userId: farmland.user_id,
      summary: analysis.summary,
      detailed_advice: analysis.detailed_advice,
      step_by_step_steps: analysis.step_by_step_steps,
      action_type: analysis.action_type,
      weather_snapshot: weatherSnapshot,
    });

    return await this.aiRepo.save(recommendation);
  }

  // async getRecommendationDetail(id: number): Promise<AiRecommendation> {
  //   const recommendation = await this.aiRepo.findOne({
  //     where: { id },
  //     relations: {
  //       farmland: {
  //         commodity: true,
  //       },
  //     },
  //   });

  //   if (!recommendation) {
  //     throw new NotFoundException(`Rekomendasi AI dengan ID ${id} tidak ditemukan`);
  //   }

  //   if (!recommendation.is_read) {
  //     recommendation.is_read = true;
  //     await this.aiRepo.save(recommendation);
  //   }

  //   return recommendation;
  // }

  async getUserRecommendations(userId: number): Promise<AiRecommendation[]> {
    return await this.aiRepo.find({
      where: { userId },
      order: { created_at: 'DESC' },
      relations: {
        farmland: true,
      },
    });
  }

  private generateFallbackRecommendation(
    farmland: Farmland,
    currentWeather?: WeatherForecast,
  ): WeatherAiAnalysis {
    return {
      summary: `Pemantauan rutin lahan ${farmland.name} berjalan normal.`,
      detailed_advice: `Kondisi cuaca terpantau stabil. Lanjutkan aktivitas pemeliharaan tanaman harian sesuai SOP.`,
      step_by_step_steps: [
        'Langkah 1: Periksa ketersediaan air irigasi di saluran.',
        'Langkah 2: Lakukan pengamatan visual pada kesehatan daun tanaman.',
      ],
      action_type: 'NORMAL',
    };
  }

  // =========================================================================
  // FITUR: MARKET ANALYSIS & LAHAN HOOKS (DENGAN DUKUNGAN BPS PUSAT)
  // =========================================================================

  // Trigger otomatis ketika lahan baru dibuat
  async onFarmlandCreated(farmlandId: number): Promise<void> {
    const farmland = await this.farmlandRepo.findOne({
      where: { id: farmlandId },
      relations: { commodity: true },
    });

    if (!farmland || farmland.status !== 'active') return;

    // A. Hitung dan simpan estimasi hasil panen
    const estimatedYield = this.calculateInitialYield(farmland);
    farmland.ai_estimated_yield_kg = estimatedYield;
    await this.farmlandRepo.save(farmland);

    // B. Jalankan rekomendasi cuaca presisi (Pakai method existing)
    await this.generateAndSaveRecommendationForFarmland(farmlandId);

    // C. Update analisis pasar provinsi
    if (farmland.adm4_code) {
      const provinceCode = farmland.adm4_code.substring(0, 2);
      this.generateMarketAnalysisForProvince(provinceCode).catch((err) =>
        this.logger.error(`Gagal trigger analisis pasar provinsi: ${err.message}`),
      );
    }
  }

  // Formula dasar kalkulasi estimasi panen AI
  private calculateInitialYield(farmland: Farmland): number {
  const area = Number(farmland.area_size || 0);
  const baseYieldPerM2 = 0.5; // Standard 0.5 kg/m²
  const baselineYield = area * baseYieldPerM2;

  // Jika petani menginput estimasi mandiri
  if (farmland.expected_yield_user_kg && Number(farmland.expected_yield_user_kg) > 0) {
    // Ambil nilai tengah antara kalkulasi sistem & input petani agar rasional
    return Math.round((baselineYield + Number(farmland.expected_yield_user_kg)) / 2);
  }

  return Math.round(baselineYield);
}

  // Fungsi khusus untuk analisis agregat pasar provinsi + sampel BMKG + Data Baseline BPS
  async generateMarketAnalysisForProvince(provinceCode: string): Promise<MarketAnalysis[]> {
    const farmlandsInProvince = await this.farmlandRepo
      .createQueryBuilder('farmland')
      .leftJoinAndSelect('farmland.commodity', 'commodity')
      .where('farmland.adm4_code LIKE :provCode', { provCode: `${provinceCode}%` })
      .andWhere('farmland.status = :status', { status: 'active' })
      .getMany();

    if (farmlandsInProvince.length === 0) return [];

    // 1. Ambil maksimal 3 sampel ADM4 unik untuk fetch data cuaca BMKG
    const uniqueAdm4Codes = Array.from(
      new Set(farmlandsInProvince.map((f) => f.adm4_code).filter(Boolean)),
    ).slice(0, 3);

    const weatherSnapshots: { adm4: string; weather: WeatherForecast[] }[] = [];
    for (const adm4 of uniqueAdm4Codes) {
      try {
        const forecasts = await this.bmkgService.getWeatherForecast(adm4);
        weatherSnapshots.push({ adm4, weather: forecasts.slice(0, 2) });
      } catch (err: any) {
        this.logger.warn(`Gagal mengambil BMKG untuk ADM4 ${adm4}:${err.message}`);
      }
    }

    // 2. Ambil data baseline statistik resmi dari BPS Pusat
    const bpsBaselineData = await this.bpsService.getRegionalAgriculturalBaseline(provinceCode);

    // Grouping lahan berdasarkan komoditas dari relasi Farmland -> Commodity
    const commodityGroups: { [key: string]: Farmland[] } = {};
    for (const f of farmlandsInProvince) {
      const commName = f.commodity?.name || 'Komoditas Lain';
      if (!commodityGroups[commName]) commodityGroups[commName] = [];
      commodityGroups[commName].push(f);
    }

    const results: MarketAnalysis[] = [];

    for (const [commodityName, lands] of Object.entries(commodityGroups)) {
      const totalArea = lands.reduce((acc, l) => acc + Number(l.area_size || 0), 0);
      const totalEstimatedYield = lands.reduce((acc, l) => acc + Number(l.ai_estimated_yield_kg || 0), 0);
      const plantDates = lands.map((l) => l.plant_date).filter(Boolean);

      const commDetail = lands[0]?.commodity;
      const commodityParams = commDetail
        ? {
            avg_harvest_days: commDetail.avg_harvest_days,
            temp_range: `${commDetail.min_temp_celsius}°C -${commDetail.max_temp_celsius}°C`,
            max_humidity: `${commDetail.max_humidity_percentage}%`,
          }
        : {};

      const prompt = `
Kamu adalah Pakar Ekonomi Pertanian, Analis Komoditas, & Market Intelligence Senior di Indonesia.
Tugas utama kamu adalah melakukan analisis pasar yang presisi, obyektif, dan logis untuk komoditas '${commodityName}' di Provinsi (Kode Provinsi:${provinceCode}).

=====================================================================
1. DATA INPUT LENGKAP
=====================================================================

[A. DATA SAMPEL INTERNAL TANI SIAGA (MIKRO - REAL TIME)]
- Total Lahan Terdaftar: ${lands.length} lahan
- Total Luas Lahan: ${totalArea} m²
- Total Estimasi Hasil Panen AI: ${totalEstimatedYield} Kg
- Distribusi Tanggal Tanam Petani: ${JSON.stringify(plantDates)}
- Parameter Ideal Komoditas: ${JSON.stringify(commodityParams)}

[B. DATA BASELINE STATISTIK BPS PUSAT (MAKRO - HISTORIS REGIONAL)]
${
  bpsBaselineData
    ? JSON.stringify(bpsBaselineData)
    : 'Data BPS tidak spesifik, gunakan asumsi rata-rata produktivitas historis daerah setempat.'
}

[C. DATA PREDIKSI CUACA BMKG (FAKTOR RISIKO IKLIM)]
${JSON.stringify(weatherSnapshots)}

=====================================================================
2. METODOLOGI & ATURAN ANALISIS (MUST FOLLOW)
=====================================================================

Gunakan algoritma berpikir berurutan berikut untuk menghasilkan analisis yang akurat:

LANGKAH 1: PEMBOBOTAN PASOKAN REGIONAL (SUPPLY WEIGHTING)
- Jika jumlah sampel Tani Siaga (${lands.length} lahan) tergolong sedikit (< 50 lahan), gunakan Data Baseline BPS sebagai **Bobot Utama (80%)** dan Data Tani Siaga sebagai **Sinyal Tren Lokal (20%)**.
- Jika sampel Tani Siaga melimpah (> 50 lahan), tingkatkan bobot sampel Tani Siaga menjadi hingga 50%.

LANGKAH 2: KALKULASI PROYEKSI PANEN & EVALUASI CUACA BMKG (PEMBATASAN WILAYAH)
- **FOKUS WILAYAH UTAMA**: Utamakan data cuaca BMKG dari lahan yang sedang dianalisis.
- **RESTRIKSI BATAS KABUPATEN**: Jika mengambil sampel cuaca dari lahan lain dalam array input, kamu WAJIB mencocokkan kode ADM4-nya. Pilih HANYA lahan yang memiliki 2 segmen awal kode ADM4 yang sama dengan lahan fokus (misal: '32.13.xx.xxxx' harus sama-sama '32.13').
- **DILARANG KERAS** menggunakan contoh cuaca ekstrem dari wilayah/kabupaten lain yang beda kode ADM4 depannya, agar analisis cuaca tidak meleset dan tetap relevan dengan lokasi setempat.
- Analisis distribusi tanggal tanam untuk memprediksi kapan Puncak Panen Raya terjadi dalam 30-60 hari ke depan.
- Evaluasi data cuaca BMKG lokal tersebut. Jika terdapat indikasi hujan ekstrem, kekeringan, atau suhu di luar batas ideal komoditas, kurangi (*downgrade*) potensi estimasi panen sebesar 10% - 30% akibat risiko gagal panen / serangan hama.

LANGKAH 3: PENETAPAN HUKUM EKONOMI PASAR (LOGIKA WAJIB)
- Jika Pasokan Bersih (BPS + Tani Siaga - Koreksi Cuaca) > Kebutuhan Rata-rata Daerah -> Pasokan **SURPLUS** (surplus_percentage > 0).
- Jika Pasokan **SURPLUS**, maka Proyeksi Harga HARUS **TURUN** atau **STABIL** (jika surplus sangat kecil < 3%).
- Jika Pasokan Bersih < Kebutuhan Rata-rata Daerah -> Pasokan **DEFISIT** (surplus_percentage < 0).
- Jika Pasokan **DEFISIT**, maka Proyeksi Harga HARUS **NAIK**.

LANGKAH 4: ANALOGI & PEMBELAJARAN HISTORIS (1 PARAGRAF TAMBAHAN)
- Cari dan hubungkan kondisi lahan/cuaca/pasokan saat ini dengan **peristiwa atau krisis serupa di masa lalu di Indonesia** (misal: fenomena El Niño/La Niña tahun tertentu, krisis harga cabai/bawang, atau gelombang cuaca buruk regional tertentu).
- Tuliskan 1 paragraf naratif yang menjelaskan pembelajaran dari peristiwa sejarah tersebut dan apa yang mungkin terjadi ke depan.
- **PENTING**: Buat penafsiran ini sebagai wawasan referensi/edukasi yang **TIDAK WAJIB** diikuti oleh petani, melainkan sebagai bahan pertimbangan kewaspadaan dini.

LANGKAH 5: KESIMPULAN SEDERHANA (1 KALIMAT SINGKAT)
- Buat 1 kalimat kesimpulan yang sangat ringkas, to the point, dan menggunakan bahasa sehari-hari yang mudah dipahami petani tanpa istilah teknis atau ekonomi yang rumit.

=====================================================================
3. FORMAT OUTPUT (STRICT JSON ONLY)
=====================================================================

Jawab HANYA dalam format JSON valid tanpa tambahan teks penjelasan di luar JSON atau markdown block (tanpa \`\`\`json):

{
  "surplus_percentage": 0.0,
  "price_trend": "NAIK | TURUN | STABIL",
  "simple_summary_for_farmers": "Satu kalimat kesimpulan singkat dan sangat mudah dipahami petani tanpa istilah rumit.",
  "analysis_summary": "Penjelasan kuantitatif & kualitatif gabungan BPS, Tani Siaga, dan BMKG secara ringkas dan padat (fokus pada wilayah kabupaten setempat).",
  "historical_analogy_context": "Satu paragraf penjelas situasi saat ini dan prediksi kedepan yang membandingkannya dengan kejadian/kejadian krisis historis nyata yang mirip di Indonesia di masa lalu. Berikan disclaimer halus bahwa data historis ini adalah wawasan pendukung yang tidak wajib diikuti, namun berguna untuk kewaspadaan.",
  "future_prediction": {
    "weather_impact_assessment": "Dampak persentase penurunan/peningkatan hasil panen akibat faktor cuaca BMKG lokal.",
    "next_month_surplus_percentage": 0.0,
    "price_forecast_reason": "Alasan mendasar penetapan tren harga berdasarkan Hukum Penawaran dan Permintaan."
  }
}
`;

      try {
        const response = await this.callGeminiWithRetry(prompt);

        const responseText = response?.text?.trim() || '';
        const cleanedJsonStr = responseText
          .replace(/^```json\s*/i, '')
          .replace(/^```\s*/i, '')
          .replace(/\s*```$/i, '')
          .trim();

        const parsed = JSON.parse(cleanedJsonStr);

        const saved = await this.marketAnalysisRepo.save(
          this.marketAnalysisRepo.create({
            province_code: provinceCode,
            commodity_name: commodityName,
            surplus_percentage: parsed.surplus_percentage ?? 0,
            price_trend: parsed.price_trend ?? 'STABIL',
            analysis_summary: parsed.analysis_summary ?? '',
            prediction_meta: {
              ...parsed.future_prediction,
              simple_summary_for_farmers: parsed.simple_summary_for_farmers, // 👈 Simpan ringkasan petani
              historical_analogy_context: parsed.historical_analogy_context, // 👈 Simpan konteks historis
              weather_snapshot_used: weatherSnapshots,
              bps_baseline_used: !!bpsBaselineData,
            },
          }),
        );

        results.push(saved);
      } catch (err: any) {
        this.logger.error(`Gagal analisis pasar provinsi ${provinceCode}: ${err.message}`);
      }
    }

    return results;
  }

  private async callGeminiWithRetry(prompt: string, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await this.ai.models.generateContent({
          model: 'gemini-3.1-flash-lite',
          contents: prompt,
        });
        return result;
      } catch (error: any) {
        const isUnavailable =
          error?.status === 503 ||
          error?.status === 429 ||
          error?.message?.includes('503') ||
          error?.message?.includes('high demand') ||
          error?.message?.includes('UNAVAILABLE');

        if (isUnavailable && attempt < maxRetries) {
          const waitTime = attempt * 3000;
          this.logger.warn(
            `[Gemini AI] Server sibuk (503). Mencoba ulang percobaan ke-${attempt} dalam ${waitTime / 1000} detik...`,
          );
          await new Promise((resolve) => setTimeout(resolve, waitTime));
        } else {
          throw error;
        }
      }
    }

    throw new Error('Gagal memproses permintaan AI setelah beberapa kali percobaan.');
  }

  async onModuleInit() {
    await this.listAvailableModels();
  }

  // Tambahkan method ini di AiService
  async listAvailableModels() {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`,
      );
      const data = await response.json();
      this.logger.log('--- DAFTAR MODEL GEMINI TERSEDIA ---');
      if (data.models) {
        data.models.forEach((m: any) => {
          if (m.supportedGenerationMethods?.includes('generateContent')) {
            this.logger.log(`Model ID: ${m.name.replace('models/', '')}`);
          }
        });
      } else {
        this.logger.error('Respon API:', JSON.stringify(data));
      }
    } catch (error: any) {
      this.logger.error('Gagal mengambil daftar model:', error.message);
    }
  }

  async getMyAndGroupMarketAnalysisHistory(
    userId: number,
    farmerGroupId: number | null,
    query: QueryHistoryDto,
  ) {
    const { page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    // Filter lahan: Milik user OR Milik Poktan user (jika user tergabung dalam Poktan)
    const farmlandWhereConditions: any[] = [{ user_id: userId }];
    if (farmerGroupId) {
      farmlandWhereConditions.push({ farmer_group_id: farmerGroupId });
    }

    const farmlands = await this.farmlandRepo.find({
      where: farmlandWhereConditions,
      relations: {
        commodity: true,
      },
      select: {
        id: true,
        name: true,
        adm4_code: true,
        commodity: { id: true, name: true },
      },
    });

    if (!farmlands.length) {
      return {
        data: [],
        meta: { total: 0, page, limit, totalPages: 0 },
      };
    }

    const provinceCommodityPairs = [...new Map(
      farmlands.flatMap((farmland) => {
        const provinceCode = farmland.adm4_code?.substring(0, 2);
        const commodityName = farmland.commodity?.name;
        if (!provinceCode || !commodityName) return [];
        return [[`${provinceCode}:${commodityName}`, { provinceCode, commodityName }]];
      }),
    ).values()];

    if (!provinceCommodityPairs.length) {
      return {
        data: [],
        meta: { total: 0, page, limit, totalPages: 0 },
      };
    }

    const analysisQuery = this.marketAnalysisRepo.createQueryBuilder('analysis')
      .where(new Brackets((builder) => {
        provinceCommodityPairs.forEach((pair, index) => {
          const condition = `analysis.province_code = :provinceCode${index} AND analysis.commodity_name = :commodityName${index}`;
          const parameters = { [`provinceCode${index}`]: pair.provinceCode, [`commodityName${index}`]: pair.commodityName };
          if (index === 0) builder.where(condition, parameters);
          else builder.orWhere(condition, parameters);
        });
      }))
      .orderBy('analysis.created_at', 'DESC')
      .skip(skip)
      .take(limit);
    const [analyses, total] = await analysisQuery.getManyAndCount();

    // Petakan relasi lahan-lahan kita yang relevan ke dalam setiap objek MarketAnalysis
    const mappedData = analyses.map((analysis) => {
      const relatedFarmlands = farmlands.filter(
        (f) =>
          f.adm4_code?.substring(0, 2) === analysis.province_code &&
          f.commodity?.name === analysis.commodity_name,
      );

      return {
        ...analysis,
        related_farmlands: relatedFarmlands.map((f) => ({
          id: f.id,
          name: f.name,
          adm4_code: f.adm4_code,
        })),
      };
    });

    return {
      data: mappedData,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // =========================================================================
  // 2. Get 1 Detail Market Analysis by Param ID
  // =========================================================================
  async getMarketAnalysisDetail(id: number, userId: number, farmerGroupId: number | null) {
    const farmlandWhereConditions: any[] = [{ user_id: userId }];
    if (farmerGroupId) farmlandWhereConditions.push({ farmer_group_id: farmerGroupId });

    const [analysis, farmlands] = await Promise.all([
      this.marketAnalysisRepo.findOne({ where: { id } }),
      this.farmlandRepo.find({
        where: farmlandWhereConditions,
        relations: { commodity: true },
        select: { id: true, name: true, adm4_code: true, commodity: { id: true, name: true } },
      }),
    ]);

    if (!analysis) {
      throw new NotFoundException(`Market Analysis dengan ID ${id} tidak ditemukan.`);
    }

    const relatedFarmlands = farmlands.filter((farmland) =>
      farmland.adm4_code?.substring(0, 2) === analysis.province_code &&
      farmland.commodity?.name === analysis.commodity_name,
    );
    if (!relatedFarmlands.length) {
      throw new NotFoundException(`Market Analysis dengan ID ${id} tidak ditemukan.`);
    }

    return {
      ...analysis,
      related_farmlands: relatedFarmlands.map((farmland) => ({ id: farmland.id, name: farmland.name, adm4_code: farmland.adm4_code })),
    };
  }

  // =========================================================================
  // 3. Get 1 Detail AI Recommendation by Param ID
  // =========================================================================
  async getMyAndGroupRecommendationsHistory(
    userId: number,
    farmerGroupId: number | null,
    query: QueryHistoryDto,
  ) {
    const { page = 1, limit = 12 } = query;
    const skip = (page - 1) * limit;
    const farmlandWhereConditions: any[] = [{ user_id: userId }];
    if (farmerGroupId) farmlandWhereConditions.push({ farmer_group_id: farmerGroupId });

    const farmlands = await this.farmlandRepo.find({
      where: farmlandWhereConditions,
      select: { id: true },
    });
    const farmlandIds = farmlands.map((farmland) => farmland.id);
    if (!farmlandIds.length) {
      return { data: [], meta: { total: 0, page, limit, totalPages: 0 } };
    }

    const [data, total] = await this.aiRepo.findAndCount({
      where: { farmlandId: In(farmlandIds) },
      relations: { farmland: { commodity: true } },
      order: { created_at: 'DESC' },
      take: limit,
      skip,
    });

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async getRecommendationDetail(id: number, userId: number, farmerGroupId: number | null) {
    const recommendation = await this.aiRepo.findOne({
      where: { id },
      relations: {
        farmland: {
          commodity: true,
        },
      },
    });

    if (
      !recommendation ||
      (Number(recommendation.farmland?.user_id) !== Number(userId) &&
        (!farmerGroupId || Number(recommendation.farmland?.farmer_group_id) !== Number(farmerGroupId)))
    ) {
      throw new NotFoundException(`Rekomendasi AI dengan ID ${id} tidak ditemukan.`);
    }

    return recommendation;
  }

  // =========================================================================
  // 4. Get History AI Recommendation khusus untuk 1 Lahan Spesifik
  // =========================================================================
  async getFarmlandRecommendationsHistory(
    farmlandId: number,
    query: QueryHistoryDto,
  ) {
    const { page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    const farmland = await this.farmlandRepo.findOne({
      where: { id: farmlandId },
      relations: {
        commodity: true,
      },
    });

    if (!farmland) {
      throw new NotFoundException(`Lahan dengan ID ${farmlandId} tidak ditemukan.`);
    }

    if (farmland.status !== 'active') {
      return {
        farmland: { id: farmland.id, name: farmland.name, adm4_code: farmland.adm4_code, commodity_name: farmland.commodity?.name || null },
        data: [],
        meta: { total: 0, page, limit, totalPages: 0 },
      };
    }

    const [data, total] = await this.aiRepo.findAndCount({
      where: {
        farmlandId: farmlandId,
        ...(farmland.plant_date ? { created_at: MoreThanOrEqual(new Date(farmland.plant_date)) } : {}),
      },
      order: { created_at: 'DESC' },
      take: limit,
      skip: skip,
    });

    return {
      farmland: {
        id: farmland.id,
        name: farmland.name,
        adm4_code: farmland.adm4_code,
        commodity_name: farmland.commodity?.name || null,
      },
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getFarmlandMarketAnalysisHistory(
    farmlandId: number,
    query: QueryHistoryDto,
  ) {
    const { page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    // 1. Ambil data lahan beserta komoditasnya
    const farmland = await this.farmlandRepo.findOne({
      where: { id: farmlandId },
      relations: {
        commodity: true,
      },
    });

    if (!farmland) {
      throw new NotFoundException(`Lahan dengan ID ${farmlandId} tidak ditemukan.`);
    }

    if (farmland.status !== 'active') {
      return {
        farmland: { id: farmland.id, name: farmland.name, province_code: farmland.adm4_code?.substring(0, 2) || null, commodity_name: farmland.commodity?.name || null },
        data: [],
        meta: { total: 0, page, limit, totalPages: 0 },
      };
    }

    // 2. Ekstrak province_code dan commodity_name
    const provinceCode = farmland.adm4_code?.substring(0, 2);
    const commodityName = farmland.commodity?.name;

    if (!provinceCode || !commodityName) {
      return {
        farmland: {
          id: farmland.id,
          name: farmland.name,
          province_code: provinceCode || null,
          commodity_name: commodityName || null,
        },
        data: [],
        meta: { total: 0, page, limit, totalPages: 0 },
      };
    }

    // 3. Query history market_analysis berdasarkan provinsi & komoditas lahan ini
    const [data, total] = await this.marketAnalysisRepo.findAndCount({
      where: {
        province_code: provinceCode,
        commodity_name: commodityName,
        ...(farmland.plant_date ? { created_at: MoreThanOrEqual(new Date(farmland.plant_date)) } : {}),
      },
      order: { created_at: 'DESC' },
      take: limit,
      skip: skip,
    });

    return {
      farmland: {
        id: farmland.id,
        name: farmland.name,
        province_code: provinceCode,
        commodity_name: commodityName,
      },
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}