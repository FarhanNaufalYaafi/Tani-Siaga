import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { Repository } from 'typeorm';
import { SignUpLocalDto } from './dtos/signup-local.dto';
import * as bcrypt from 'bcryptjs'
import { SignUpGoogleDto } from './dtos/signup-google.dto';
import { UpdateUserDto } from './dtos/update-user.dto';
import { GroupStatus } from './enum/group-status.enum';
import { userRoles } from './enum/user-roles.enum';

@Injectable()
export class UserService {
    constructor(@InjectRepository(User) private userRepo: Repository<User>){ }

    async create(request: SignUpLocalDto){
        const user = await this.userRepo.create(request)
        return await this.userRepo.save(user)
    }

    async createPendingSignup(email: string, password: string, codeHash: string, expiresAt: Date) {
        const user = this.userRepo.create({
            email,
            password,
            emailVerified: false,
            verificationCodeHash: codeHash,
            verificationCodePurpose: 'signup',
            verificationCodeExpiresAt: expiresAt,
            verificationCodeSentAt: new Date(),
            verificationCodeAttempts: 0,
        });
        return this.userRepo.save(user);
    }

    async updateVerificationCode(userId: number, purpose: string, codeHash: string, expiresAt: Date) {
        return this.userRepo.update(userId, {
            verificationCodeHash: codeHash,
            verificationCodePurpose: purpose,
            verificationCodeExpiresAt: expiresAt,
            verificationCodeSentAt: new Date(),
            verificationCodeAttempts: 0,
        });
    }

    async incrementVerificationCodeAttempts(userId: number) {
        await this.userRepo.increment({ id: userId }, 'verificationCodeAttempts', 1);
    }

    async clearVerificationCode(userId: number) {
        return this.userRepo.update(userId, {
            verificationCodeHash: null,
            verificationCodePurpose: null,
            verificationCodeExpiresAt: null,
            verificationCodeSentAt: null,
            verificationCodeAttempts: 0,
        });
    }

    async createGoogle(request: SignUpGoogleDto){
        const user = await this.userRepo.create(request)
        return await this.userRepo.save(user)
    }
    
    findOneId(id: number){
        return this.userRepo.findOne({
            where: { id },
        })
    }

    findOneIdWithShop(id: number) {
        return this.userRepo.findOne({
            where: { id },
            relations: { shop: true },
        })
    }

    findOneIdWithRefreshToken(id: number){
        return this.userRepo.findOne({
            where: { id },
            select: {
                id: true,
                email: true,
                role: true,
                hashedRefreshToken: true,
            },
        })
    }

    async getPendingMembersByGroupId(groupId: number) {
        return await this.userRepo.find({
            where: {
                pending_farmer_group_id: groupId,
                group_status: GroupStatus.PENDING,
            },
            select: {
                id: true,
                email: true,
                role: true,
                group_status: true,
        },
  });
}

    async addMemberToGroup(userId: number, groupId: number) {
        const user = await this.findOneId(userId);

        if (!user) {
            throw new NotFoundException(`User dengan ID ${userId} tidak ditemukan`);
        }

        if (user.farmer_group_id) {
            throw new BadRequestException('User sudah terdaftar di kelompok tani lain');
        }

        return await this.userRepo.update(userId, {
            farmer_group_id: groupId,
            pending_farmer_group_id: null,
            group_status: GroupStatus.APPROVED,
        });
}
    
    async removeMemberFromGroup(userId: number, groupId: number) {
        const user = await this.findOneId(userId);

        if (!user) {
            throw new NotFoundException(`User dengan ID ${userId} tidak ditemukan`);
        }

        if (user.farmer_group_id !== groupId) {
            throw new BadRequestException('User ini bukan anggota dari kelompok tani Anda');
        }

        return await this.userRepo.update(userId, {
            farmer_group_id: null,
            pending_farmer_group_id: null,
            group_status: GroupStatus.NONE,
            role: userRoles.USER
        });
}

    async leaveGroup(userId: number) {
        const user = await this.findOneId(userId);

        if (!user) {
            throw new NotFoundException(`User dengan ID ${userId} tidak ditemukan`);
        }

        if (!user.farmer_group_id) {
            throw new BadRequestException('Anda belum bergabung dalam kelompok tani manapun');
        }

        if (user.role === userRoles.GROUP_LEADER) {
            throw new BadRequestException('Ketua kelompok tidak bisa keluar. Silakan bubarkan terlebih dahulu');
        }

        return await this.userRepo.update(userId, {
            farmer_group_id: null,
            pending_farmer_group_id: null,
            group_status: GroupStatus.NONE,
            role: userRoles.USER
        });
    }

    findOneEmail(email: string){
        return this.userRepo.findOne({
            where: {email}
        })
    }

    async update(id: number, attrs: Partial<User>){
        const user = await this.findOneId(id)
        
        if(!user){
            throw new NotFoundException('user not found')
        }
        Object.assign(user, attrs)

        return await this.userRepo.save(user)
    }

    async userUpdate(userId: number, request: UpdateUserDto){
        const user = await this.findOneId(userId)

        if(!user){
            throw new NotFoundException()
        }

        if(request.password){
            throw new BadRequestException('Gunakan proses konfirmasi email untuk mengubah password.');
        }
        Object.assign(user, request)
        

        return await this.userRepo.save(user)
    }

    
                                                                                                                                                                                                                                        
}
