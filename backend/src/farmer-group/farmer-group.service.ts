import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateFarmerDto } from './dtos/create-farmer-group.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { FarmerGroup } from './entities/farmer-groups.entity';
import { Brackets, Repository } from 'typeorm';
import { UserService } from 'src/user/user.service';
import { GroupStatus } from 'src/user/enum/group-status.enum';
import { userRoles } from 'src/user/enum/user-roles.enum';
import { FarmerGroupApplication } from './entities/farmer-group-application.entity';
import { NotificationService } from 'src/notification/notification.service';
import { normalizePagination, paginatedResult } from 'src/common/pagination';

@Injectable()
export class FarmerGroupService {
    constructor(
        @InjectRepository(FarmerGroup) private farmerGroupRepo: Repository<FarmerGroup>,
        private userService: UserService,
        @InjectRepository(FarmerGroupApplication) private applicationRepo: Repository<FarmerGroupApplication>,
        private notificationService: NotificationService,
){}

    async create(request: CreateFarmerDto, leaderUserId: number){
      const leader = await this.userService.findOneId(leaderUserId);

      if (!leader) {
        throw new NotFoundException('Data pengguna tidak ditemukan');
      }

      if (leader.role === userRoles.GROUP_LEADER || leader.farmer_group_id) {
        throw new ConflictException('Anda sudah menjadi ketua atau anggota di kelompok tani lain');
      }

        const newGroup = this.farmerGroupRepo.create(request)
        const savedGroup = await this.farmerGroupRepo.save(newGroup)
        
        await this.userService.update(leaderUserId, {
            farmer_group_id: savedGroup.id,
            group_status: GroupStatus.APPROVED,
            role: userRoles.GROUP_LEADER,
            pending_farmer_group_id: null,
        })

        return{
            messsage: "Farmer Group created successfully",
            data: savedGroup
        }
    }

    async getAll(currentUserId: number, requestedPage = 1, requestedLimit = 8, search = '') {
  const { page, limit } = normalizePagination(requestedPage, requestedLimit);
  const query = this.farmerGroupRepo
    .createQueryBuilder('group')
    .leftJoinAndSelect('group.members', 'member')
    .select([
      'group.id',
      'group.name',
      'group.poktan_id',
      'group.created_at',
      'group.updated_at',
      'member.id',
      'member.email',
      'member.role',
      'member.group_status',
      'member.farmer_group_id',
      'member.pending_farmer_group_id',
    ])
    .orderBy('group.name', 'ASC');

  if (search.trim()) {
    query.andWhere(new Brackets((builder) => {
      builder.where('group.name ILIKE :search', { search: `%${search.trim()}%` })
        .orWhere('group.poktan_id ILIKE :search', { search: `%${search.trim()}%` });
    }));
  }

  const [groups, total] = await query.skip((page - 1) * limit).take(limit).getManyAndCount();

  const applications = await this.applicationRepo.find({ where: { userId: currentUserId } });

  const data = groups.map(({ members, ...group }) => ({
    ...group,
    members, // <-- Masukkan kembali array members di sini
    group_leader_id:
      members.find((member) => member.role === userRoles.GROUP_LEADER)?.id ?? null,
    isPending: applications.some((application) => application.groupId === group.id && application.status === 'pending'),
    applicationStatus: applications.find((application) => application.groupId === group.id)?.status || null,
  }));
  return paginatedResult(data, total, page, limit);
}

    async get(farmGroupId: number, currentUserId?: number){
      const group = await this.farmerGroupRepo
        .createQueryBuilder('group')
        .leftJoinAndSelect('group.members', 'member')
        .select([
        'group.id',
        'group.name',
        'group.poktan_id',
        'group.created_at',
        'group.updated_at',
        'member.id',
        'member.email',
        'member.role',
        'member.group_status',
        'member.farmer_group_id',
        'member.pending_farmer_group_id',
        ])
        .where('group.id = :farmGroupId', { farmGroupId })
        .getOne();

         if(!group){
            throw new NotFoundException("Group tidak ditemukan")
        }

        const groupLeader = group.members.find(
          (member) => member.role === userRoles.GROUP_LEADER,
        );

        const currentUser = currentUserId ? await this.userService.findOneId(currentUserId) : null;
        const application = currentUser
          ? await this.applicationRepo.findOne({ where: { userId: currentUser.id, groupId: farmGroupId } })
          : null;

        return {
          ...group,
          group_leader_id: groupLeader?.id ?? null,
          isPending: application?.status === 'pending',
          applicationStatus: application?.status || null,
        };
    }

    async applyToGroup(groupId: number, userId){
        const group = await this.get(groupId)
        if (!group) throw new NotFoundException("Group tidak ada")

        const user = await this.userService.findOneId(userId)
        if(user?.farmer_group_id) throw new BadRequestException('Kamu sudah terdaftar di kelompok tani lain');

        const existing = await this.applicationRepo.findOne({ where: { userId, groupId } });
        if (existing?.status === 'pending') throw new ConflictException('Pengajuan ke grup ini masih menunggu respons');
        const application = existing || this.applicationRepo.create({ userId, groupId });
        application.status = 'pending';
        await this.applicationRepo.save(application);
        await this.userService.update(userId, { group_status: GroupStatus.PENDING, pending_farmer_group_id: groupId });

        const leader = await this.userService.findOneId((group as any).group_leader_id);
        if (leader?.id) {
          await this.notificationService.createInAppNotification({
            userId: leader.id,
            title: 'Pengajuan anggota baru',
            message: 'Ada pengguna yang mengajukan bergabung ke kelompok tani Anda.',
            type: 'group_application',
            severity: 'warning',
            targetUrl: '/kelompok-tani',
          });
        }

        return { message: 'Berhasil mengajukan permohonan bergabung ke kelompok tani'};
    }

    async getPendingMembers(leaderUserId: number){
        const leader = await this.userService.findOneId(leaderUserId);
        if (!leader!.farmer_group_id || leader!.role !== userRoles.GROUP_LEADER) {
            throw new ForbiddenException('Hanya Ketua Poktan dari kelompok ini yang bisa menerima anggota');
        }

        const applications = await this.applicationRepo.find({
          where: { groupId: leader!.farmer_group_id, status: 'pending' },
          relations: { user: true },
        });
        return applications.map((application) => application.user);
    }

    async approveMember(targetUserId: number, leaderUserId: number) {

    const leader = await this.userService.findOneId(leaderUserId);
    if (!leader!.farmer_group_id || leader!.role !== userRoles.GROUP_LEADER) {
      throw new ForbiddenException('Hanya Ketua Poktan dari kelompok ini yang bisa menerima anggota');
    }

    const groupId = leader!.farmer_group_id

    const groupApplication = await this.applicationRepo.findOne({ where: { userId: targetUserId, groupId, status: 'pending' } });
    if (!groupApplication) {
      throw new BadRequestException('User tidak sedang mengajukan diri ke Poktan ini');
    }

    await this.userService.update(targetUserId, {
      farmer_group_id: groupId,
      pending_farmer_group_id: null,
      group_status: GroupStatus.APPROVED,
      role: userRoles.FARMER
    });
    groupApplication.status = 'approved';
    await this.applicationRepo.save(groupApplication);
    await this.notificationService.createInAppNotification({
      userId: targetUserId,
      title: 'Pengajuan kelompok disetujui',
      message: 'Pengajuan bergabung Anda telah disetujui oleh ketua kelompok tani.',
      type: 'group_application',
      severity: 'safe',
      targetUrl: `/kelompok-tani/${groupId}`,
    });

    return { message: 'Anggota berhasil disetujui dan dimasukkan ke kelompok tani' };
  }

  async rejectMember(targetUserId: number, leaderUserId: number) {

    const leader = await this.userService.findOneId(leaderUserId);
    if (!leader!.farmer_group_id || leader!.role !== userRoles.GROUP_LEADER) {
      throw new ForbiddenException('Hanya Ketua Poktan dari kelompok ini yang bisa menolak anggota');
    }

    const groupId = leader!.farmer_group_id
    const targetUser = await this.userService.findOneId(targetUserId);

    const groupApplication = await this.applicationRepo.findOne({ where: { userId: targetUserId, groupId, status: 'pending' } });
    if (!groupApplication) {
      throw new BadRequestException('User tidak sedang mengajukan diri ke Poktan ini');
    }

    await this.userService.update(targetUserId, {
      farmer_group_id: groupId,
      pending_farmer_group_id: null,
      group_status: GroupStatus.NONE,
    });
    groupApplication.status = 'rejected';
    await this.applicationRepo.save(groupApplication);
    await this.notificationService.createInAppNotification({
      userId: targetUserId,
      title: 'Pengajuan kelompok ditolak',
      message: 'Pengajuan bergabung Anda ditolak. Anda dapat mengajukan kembali nanti.',
      type: 'group_application',
      severity: 'danger',
      targetUrl: '/kelompok-tani',
    });

    return { message: 'Anggota telah ditolak dari kelompok tani' };
  }

  async addMember(targetUserId: number, leaderUserId: number) {

    const leader = await this.userService.findOneId(leaderUserId);
    if (!leader!.farmer_group_id || leader!.role !== userRoles.GROUP_LEADER) {
      throw new ForbiddenException('Hanya Ketua Poktan dari kelompok ini yang bisa menambahkan anggota');
    }

    const groupId = leader!.farmer_group_id

    await this.userService.addMemberToGroup(targetUserId, groupId);

    await this.userService.update(targetUserId, {
        role: userRoles.FARMER
    })
    return {
      message: `Berhasil menambahkan anggota ke grup`,
    };
  }
  async removeMember(targetUserId: number, leaderUserId: number) {

    const leader = await this.userService.findOneId(leaderUserId);
    if (!leader!.farmer_group_id || leader!.role !== userRoles.GROUP_LEADER) {
      throw new ForbiddenException('Hanya Ketua Poktan dari kelompok ini yang bisa mengeluarkan anggota');
    }

    if (targetUserId === leaderUserId) {
        throw new BadRequestException('Ketua tidak dapat mengeluarkan dirinya sendiri dari kelompok');
    }

    await this.userService.removeMemberFromGroup(targetUserId, leader!.farmer_group_id);

    return {
        message: 'Anggota berhasil dikeluarkan dari kelompok tani',
    };
  }
  
  async leaveGroup(userId: number) {
    await this.userService.leaveGroup(userId);

    return {
        message: 'Anda berhasil keluar dari kelompok tani',
    };
  }
}