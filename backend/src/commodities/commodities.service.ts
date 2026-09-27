import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike, IsNull } from 'typeorm';
import { Commodity } from './entities/commodity.entity';
import { CreateCommodityDto } from './dtos/create-commodity.dto';
import { UpdateCommodityDto } from './dtos/update-commdity.dto';
import { normalizePagination, paginatedResult } from 'src/common/pagination';

@Injectable()
export class CommoditiesService {
  constructor(
    @InjectRepository(Commodity)
    private readonly commodityRepo: Repository<Commodity>,
  ) {}

              
  async create(dto: CreateCommodityDto) {
    const trimmedName = dto.name.trim();
    const trimmedVariety = dto.variety ? dto.variety.trim() : null;

    const existingCommodity = await this.commodityRepo.findOne({
      where: {
        name: ILike(trimmedName),
        variety: trimmedVariety ? ILike(trimmedVariety) : IsNull(),
      },
    });

    if (existingCommodity) {
      const varietyInfo = trimmedVariety ? ` varietas '${trimmedVariety}'` : '';
      throw new ConflictException(
        `Komoditas '${trimmedName}'${varietyInfo} sudah terdaftar dalam sistem`,
      );
    }

    const commodity = this.commodityRepo.create({
      ...dto,
      name: trimmedName,
      variety: trimmedVariety ?? undefined,
    });

    return await this.commodityRepo.save(commodity);
  }

                                                   
  async findAll(requestedPage = 1, requestedLimit = 8, search = '') {
    const { page, limit } = normalizePagination(requestedPage, requestedLimit);
    const query = this.commodityRepo.createQueryBuilder('commodity')
      .orderBy('commodity.name', 'ASC')
      .addOrderBy('commodity.variety', 'ASC');

    if (search.trim()) {
      query.where('(commodity.name ILIKE :search OR commodity.variety ILIKE :search)', {
        search: `%${search.trim()}%`,
      });
    }

    const [data, total] = await query.skip((page - 1) * limit).take(limit).getManyAndCount();
    return paginatedResult(data, total, page, limit);
  }

                
  async findOne(id: number) {
    const commodity = await this.commodityRepo.findOne({ where: { id } });
    if (!commodity) {
      throw new NotFoundException(`Komoditas dengan ID ${id} tidak ditemukan`);
    }
    return commodity;
  }

  // 4. UPDATE (Master Data Global)
  async update(id: number, dto: UpdateCommodityDto) {
    const commodity = await this.findOne(id);

    if (dto.name || dto.variety) {
      const targetName = dto.name ? dto.name.trim() : commodity.name;
      const targetVariety = dto.variety !== undefined
        ? (dto.variety ? dto.variety.trim() : null)
        : commodity.variety;

      const existingCommodity = await this.commodityRepo.findOne({
        where: {
          name: ILike(targetName),
          variety: targetVariety ? ILike(targetVariety) : undefined,
        },
      });

      if (existingCommodity && existingCommodity.id !== id) {
        throw new ConflictException(
          'Kombinasi nama dan varietas komoditas ini sudah digunakan data lain',
        );
      }
    }

    Object.assign(commodity, dto);
    return await this.commodityRepo.save(commodity);
  }

  async remove(id: number) {
    const commodity = await this.commodityRepo.findOne({
      where: { id },
      relations: {
        farmlands: true
      }
    });

    if (!commodity) {
      throw new NotFoundException(`Komoditas dengan ID ${id} tidak ditemukan`);
    }

    if (commodity.farmlands && commodity.farmlands.length > 0) {
      throw new BadRequestException(
        `Komoditas '${commodity.name}' tidak dapat dihapus karena sedang digunakan oleh ${commodity.farmlands.length} lahan`,
      );
    }

    await this.commodityRepo.remove(commodity);
    return {
      message: `Komoditas '${commodity.name}' berhasil dihapus dari katalog`,
    };
  }
}