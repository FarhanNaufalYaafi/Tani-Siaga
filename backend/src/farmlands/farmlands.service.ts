import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Farmland } from './entities/farmlands.entity';
import { Brackets, Repository } from 'typeorm';
import { CreateFarmlandDto } from './dtos/create-farmlands.dto';
import { UserService } from 'src/user/user.service';
import { userRoles } from 'src/user/enum/user-roles.enum';
import { UpdateFarmlandDto } from './dtos/update-farmlands.dto';
import { AiService } from 'src/ai/ai.service';
import { normalizePagination, paginatedResult } from 'src/common/pagination';

@Injectable()
export class FarmlandsService {
    private readonly logger = new Logger(FarmlandsService.name);
    constructor(
        @InjectRepository(Farmland) 
        private farmlandRepo: Repository<Farmland>,
        private userService: UserService,
        private readonly aiService: AiService,
    ){}

    async create(userId: number, request: CreateFarmlandDto){
        const user = await this.userService.findOneId(userId)

        if (!user) {
            throw new NotFoundException('Data pengguna tidak ditemukan');
        }

        const leader = user;
        const isGroupLeader = leader.role === userRoles.GROUP_LEADER && !!leader.farmer_group_id;
        const isIndividualFarmer = leader.role === userRoles.INDIVIDUAL_FARMER && !leader.farmer_group_id;
        const isNewIndividualFarmer = leader.role === userRoles.USER && !leader.farmer_group_id;

        if (!isGroupLeader && !isIndividualFarmer && !isNewIndividualFarmer) {
            throw new ForbiddenException('Hanya petani individual atau ketua kelompok yang bisa menambahkan lahan');
        }

        const farmland = this.farmlandRepo.create({
            ...request,
            user_id: user.id,
            farmer_group_id: isGroupLeader ? (leader.farmer_group_id as number) : undefined
        })

        const savedFarmland = await this.farmlandRepo.save(farmland)

        if (isNewIndividualFarmer) {
            await this.userService.update(userId, { role: userRoles.INDIVIDUAL_FARMER });
        }

        this.aiService.onFarmlandCreated(savedFarmland.id).catch((err) => {
        this.logger.error(`Gagal trigger AI saat buat lahan: ${err.message}`);
  });

                return savedFarmland;
    }

    async getAll(userId: number, requestedPage = 1, requestedLimit = 8, search = '') {
        const { page, limit } = normalizePagination(requestedPage, requestedLimit);
        const query = this.farmlandRepo.createQueryBuilder('farmland')
            .leftJoinAndSelect('farmland.commodity', 'commodity')
            .where('farmland.user_id = :userId', { userId })
            .orderBy('farmland.created_at', 'DESC');

        if (search.trim()) {
            query.andWhere(new Brackets((builder) => {
                builder.where('farmland.name ILIKE :search', { search: `%${search.trim()}%` })
                    .orWhere('commodity.name ILIKE :search', { search: `%${search.trim()}%` });
            }));
        }

        const [data, total] = await query.skip((page - 1) * limit).take(limit).getManyAndCount();
        return paginatedResult(data, total, page, limit);
    }

    async getGroupFarmlands(groupId: number, requestedPage = 1, requestedLimit = 8, search = '') {
        const { page, limit } = normalizePagination(requestedPage, requestedLimit);
        const query = this.farmlandRepo
            .createQueryBuilder('farmland')
            .leftJoinAndSelect('farmland.user', 'user')
            .leftJoinAndSelect('farmland.commodity', 'commodity')
            .select([
                'farmland.id',
                'farmland.name',
                'farmland.area_size',
                'farmland.status',
                'farmland.farmer_group_id',
                'farmland.created_at',
                'user.id',
                'user.email',
                'commodity.id',
                'commodity.name',
            ])
            .where('farmland.farmer_group_id = :groupId', { groupId })
            .orderBy('farmland.created_at', 'DESC');

        if (search.trim()) {
            query.andWhere(new Brackets((builder) => {
                builder.where('farmland.name ILIKE :search', { search: `%${search.trim()}%` })
                    .orWhere('commodity.name ILIKE :search', { search: `%${search.trim()}%` });
            }));
        }

        const [data, total] = await query.skip((page - 1) * limit).take(limit).getManyAndCount();
        return paginatedResult(data, total, page, limit);
}

    async getOne(farmlandId: number, userId: number) {
        const farmland = await this.farmlandRepo.findOne({
            where: { id: farmlandId },
            relations: {
                user: true,
                farmerGroup: true,
                commodity: true
            },
        });

        if (!farmland) {
            throw new NotFoundException(
                `Lahan dengan ID ${farmlandId} tidak ditemukan`,
            );
        }

        const user = await this.userService.findOneId(userId);
        
        const isOwner = farmland.user_id === userId;
        const isSameGroupMember =
        user?.farmer_group_id !== null &&
        farmland.farmer_group_id === user?.farmer_group_id;

        if (!isOwner && !isSameGroupMember) {
        throw new ForbiddenException(
            'Anda tidak memiliki hak akses untuk melihat data lahan ini',
        );
        }

        return farmland;
    }

    async remove(farmlandId: number, userId: number) {
        const user = await this.userService.findOneId(userId);

        if (!user) {
            throw new NotFoundException('Data pengguna tidak ditemukan');
        }

        const farmland = await this.farmlandRepo.findOne({
            where: { id: farmlandId },
        });

        if (!farmland) {
            throw new NotFoundException(
            `Lahan dengan ID ${farmlandId} tidak ditemukan`,
            );
        }

        const isOwner = farmland.user_id === userId;
        const isGroupLeaderOfThisFarmland =
            !!farmland.farmer_group_id &&
            user.role === userRoles.GROUP_LEADER &&
            user.farmer_group_id === farmland.farmer_group_id;

        if (!isOwner && !isGroupLeaderOfThisFarmland) {
            throw new ForbiddenException(
            'Hanya pemilik lahan individual atau ketua kelompok terkait yang bisa menghapus lahan ini',
            );
        }

        await this.farmlandRepo.remove(farmland);

        return {
            message: `Data lahan '${farmland.name}' berhasil dihapus`,
        };
    }

    async getAllActiveFarmlands(): Promise<Farmland[]> {
        return await this.farmlandRepo.find({
            where: { status: 'active' },
            relations: {
            commodity: true,
            user: true,
            },
        });
}

    async update(farmlandId: number, userId: number, dto: UpdateFarmlandDto) {
    // 1. Ambil data user yang sedang login
        const user = await this.userService.findOneId(userId);
        if (!user) {
            throw new NotFoundException('Data pengguna tidak ditemukan');
        }

        // 2. Ambil data lahan yang mau di-update
        const farmland = await this.farmlandRepo.findOne({
            where: { id: farmlandId },
        });

        if (!farmland) {
            throw new NotFoundException(
            `Lahan dengan ID ${farmlandId} tidak ditemukan`,
            );
        }

        // 3. Otorisasi Akses:
        // User harus pemilik lahan ATAU Ketua Poktan di kelompok tani lahan tersebut
        const isOwner = farmland.user_id === userId;
        const isGroupLeaderOfThisFarmland =
            user.role === userRoles.GROUP_LEADER &&
            user.farmer_group_id === farmland.farmer_group_id;

        if (!isOwner && !isGroupLeaderOfThisFarmland) {
            throw new ForbiddenException(
            'Anda tidak memiliki hak akses untuk memperbarui data lahan ini',
            );
        }

        if (farmland.status === 'harvested') {
            throw new BadRequestException('Lahan ini sudah panen. Gunakan alur Tanami Lagi untuk memulai musim tanam baru.');
        }

        // 4. Update properti
        Object.assign(farmland, dto);

        // 5. Simpan perubahan ke database
        await this.farmlandRepo.save(farmland);

        // Rebuild yield, AI recommendation, and the affected province market analysis.
        this.aiService.onFarmlandCreated(farmlandId).catch((err) => {
            this.logger.error(`Gagal memperbarui AI setelah update lahan: ${err.message}`);
        });

        return await this.getOne(farmlandId, userId); // Return data terbaru lengkap dengan relasi
        }

    async replant(farmlandId: number, userId: number, dto: UpdateFarmlandDto) {
        const user = await this.userService.findOneId(userId);
        if (!user) throw new NotFoundException('Data pengguna tidak ditemukan');

        const farmland = await this.farmlandRepo.findOne({ where: { id: farmlandId } });
        if (!farmland) throw new NotFoundException(`Lahan dengan ID ${farmlandId} tidak ditemukan`);

        const isOwner = farmland.user_id === userId && !farmland.farmer_group_id;
        const isGroupLeaderOfThisFarmland =
            !!farmland.farmer_group_id &&
            user.role === userRoles.GROUP_LEADER &&
            Number(user.farmer_group_id) === Number(farmland.farmer_group_id);
        if (!isOwner && !isGroupLeaderOfThisFarmland) {
            throw new ForbiddenException('Hanya pemilik lahan atau ketua kelompok terkait yang dapat menanami kembali lahan ini.');
        }

        if (farmland.status !== 'harvested') {
            throw new BadRequestException('Lahan harus berstatus sudah panen sebelum dapat ditanami kembali.');
        }
        if (!dto.commodity_id || !dto.plant_date || !dto.plant_method?.trim()) {
            throw new BadRequestException('Komoditas, tanggal tanam, dan metode tanam wajib diisi untuk musim tanam baru.');
        }
        if (dto.adm4_code && dto.adm4_code !== farmland.adm4_code) {
            throw new BadRequestException('Kode wilayah ADM4 merupakan lokasi tetap lahan dan tidak dapat diubah saat tanam ulang.');
        }

        const { adm4_code, ...replantData } = dto;
        Object.assign(farmland, replantData);
        farmland.status = 'active';
        farmland.harvested_at = null;
        farmland.expected_yield_user_kg = dto.expected_yield_user_kg ?? null;
        farmland.ai_estimated_yield_kg = null;
        farmland.custom_avg_harvest_days = dto.custom_avg_harvest_days ?? null;
        farmland.custom_max_humidity_percentage = dto.custom_max_humidity_percentage ?? null;
        farmland.custom_max_temp_celsius = dto.custom_max_temp_celsius ?? null;
        farmland.custom_min_temp_celsius = dto.custom_min_temp_celsius ?? null;
        await this.farmlandRepo.save(farmland);

        this.aiService.onFarmlandCreated(farmlandId).catch((err) => {
            this.logger.error(`Gagal memulai analisis musim tanam baru: ${err.message}`);
        });

        return this.getOne(farmlandId, userId);
    }
}
