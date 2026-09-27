import { BadRequestException, ConflictException, HttpException, Injectable, NotFoundException, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { randomInt } from 'crypto';
import { Http2ServerRequest } from 'http2';
import { threadCpuUsage } from 'process';
import { SignUpLocalDto } from 'src/user/dtos/signup-local.dto';
import { UserService } from 'src/user/user.service';
import * as bcrypt from 'bcryptjs'
import { SignInResponseDto } from './dtos/signin-response.dto';
import { providers } from 'src/user/enum/provider.enum';
import { SignInDataDto } from './dtos/signin-data.dto';
import { jwtPayload } from './types/jwt-payload.type';
import { JwtSecretRequestType, JwtService, JwtSignOptions } from '@nestjs/jwt';
import { throws } from 'assert';
import { retryWhen } from 'rxjs';
import { UpdateResult } from 'typeorm';
import { SignUpLocalResponseDto } from './dtos/signup-response.dto';
import { User } from 'src/user/entities/user.entity';
import { create } from 'domain';
import { Db } from 'typeorm/driver/mongodb/typings.js';
import { DbQueryResultCache } from 'typeorm/cache/DbQueryResultCache.js';
import { userRoles } from 'src/user/enum/user-roles.enum';
import { timeStamp } from 'console';
import { EmailService } from './email.service';

@Injectable()
export class AuthService {
    constructor(
        private userService: UserService,
        private jwtService: JwtService,
        private emailService: EmailService,
    ){}

    async createToken(request: any){

        const tokenPayload: jwtPayload = {
            sub: request.id,
            email: request.email,
            role: request.role
        }

        const accessToken = await this.jwtService.signAsync(tokenPayload, {
            secret: process.env.JWT_SECRET,
            expiresIn: '15m'
        })

        const refreshToken = await this.jwtService.signAsync(tokenPayload, {
            secret: process.env.JWT_REFRESH_SECRET!,
            expiresIn: '7d'
        })

        const hashedRefreshToken = await bcrypt.hash(refreshToken, 10)

        await this.userService.update(request.id, {
            hashedRefreshToken
        })

        return {
            accessToken,
            refreshToken
        }
    }

    async signup(request: SignUpLocalDto) {
        const email = request.email.trim().toLowerCase();
        const existing = await this.userService.findOneEmail(email);
        if (existing?.emailVerified) throw new ConflictException('Email sudah terdaftar. Silakan signin.');
        if (
            existing?.verificationCodePurpose === 'signup' &&
            existing.verificationCodeHash &&
            existing.verificationCodeExpiresAt && existing.verificationCodeExpiresAt.getTime() > Date.now() &&
            existing.verificationCodeSentAt && Date.now() - existing.verificationCodeSentAt.getTime() < 60_000
        ) {
            return { message: 'Kode verifikasi sebelumnya masih berlaku. Periksa inbox atau folder spam email Anda.' };
        }

        const code = this.generateVerificationCode();
        const codeHash = await bcrypt.hash(code, 10);
        const expiresAt = new Date(Date.now() + 3 * 60 * 1000);

        if (existing) {
            await this.assertCanResend(existing.verificationCodeSentAt);
            await this.userService.updateVerificationCode(existing.id, 'signup', codeHash, expiresAt);
        } else {
            const passwordHash = await bcrypt.hash(request.password, 10);
            await this.userService.createPendingSignup(email, passwordHash, codeHash, expiresAt);
        }

        try {
            await this.emailService.sendVerificationCode(email, code, 'signup');
        } catch {
            const pendingUser = await this.userService.findOneEmail(email);
            if (pendingUser) await this.userService.clearVerificationCode(pendingUser.id);
            throw new ServiceUnavailableException('Email verifikasi gagal dikirim. Pastikan konfigurasi SMTP sudah benar lalu coba lagi.');
        }

        return { message: 'Kode verifikasi dikirim. Periksa inbox atau folder spam email Anda.' };
    }

    async verifySignupEmail(emailInput: string, code: string) {
        const email = emailInput.trim().toLowerCase();
        const user = await this.validateEmailCode(email, code, 'signup');
        await this.userService.update(user.id, { emailVerified: true });
        await this.userService.clearVerificationCode(user.id);
        const tokens = await this.createToken(user);
        return { id: user.id, email: user.email, role: user.role, ...tokens };
    }

    async sendPasswordResetCode(emailInput: string) {
        const email = emailInput.trim().toLowerCase();
        const user = await this.userService.findOneEmail(email);
        if (!user) throw new NotFoundException('Email tidak ditemukan.');
        if (!user.emailVerified) throw new BadRequestException('Email belum diverifikasi. Selesaikan verifikasi signup terlebih dahulu.');
        if (user.provider === providers.GOOGLE || !user.password) {
            throw new BadRequestException('Akun ini menggunakan Google dan tidak memiliki password lokal.');
        }

        await this.sendCodeForUser(user, 'reset_password');
        return { message: 'Kode reset password sudah dikirim. Periksa inbox atau folder spam email Anda.' };
    }

    async verifyPasswordResetCode(emailInput: string, code: string) {
        await this.validateEmailCode(emailInput.trim().toLowerCase(), code, 'reset_password');
        return { message: 'Kode benar. Silakan buat password baru.' };
    }

    async resetPassword(emailInput: string, code: string, password: string, confirmPassword: string) {
        if (password !== confirmPassword) throw new BadRequestException('Konfirmasi password tidak cocok.');
        const user = await this.validateEmailCode(emailInput.trim().toLowerCase(), code, 'reset_password');
        await this.userService.update(user.id, {
            password: await bcrypt.hash(password, 10),
            hashedRefreshToken: null,
        });
        await this.userService.clearVerificationCode(user.id);
        return { message: 'Password berhasil direset. Silakan signin dengan password baru.' };
    }

    async sendProfilePasswordCode(userId: number, currentPassword: string) {
        const user = await this.userService.findOneId(userId);
        if (!user) throw new NotFoundException('Akun tidak ditemukan.');
        if (user.provider === providers.GOOGLE || !user.password) {
            throw new BadRequestException('Akun ini menggunakan Google dan tidak memiliki password lokal.');
        }
        if (!await bcrypt.compare(currentPassword, user.password)) {
            throw new UnauthorizedException('Password lama tidak cocok.');
        }
        await this.sendCodeForUser(user, 'profile_password');
        return { message: 'Kode konfirmasi perubahan password sudah dikirim ke email akun Anda.' };
    }

    async changeProfilePassword(userId: number, currentPassword: string, code: string, password: string, confirmPassword: string) {
        if (password !== confirmPassword) throw new BadRequestException('Konfirmasi password tidak cocok.');
        const user = await this.userService.findOneId(userId);
        if (!user) throw new NotFoundException('Akun tidak ditemukan.');
        if (user.provider === providers.GOOGLE || !user.password) {
            throw new BadRequestException('Akun ini menggunakan Google dan tidak memiliki password lokal.');
        }
        if (!await bcrypt.compare(currentPassword, user.password)) {
            throw new UnauthorizedException('Password lama tidak cocok.');
        }
        if (await bcrypt.compare(password, user.password)) {
            throw new BadRequestException('Password baru harus berbeda dari password lama.');
        }

        await this.validateEmailCode(user.email, code, 'profile_password');
        await this.userService.update(user.id, { password: await bcrypt.hash(password, 10) });
        await this.userService.clearVerificationCode(user.id);
        return { message: 'Password berhasil diperbarui.' };
    }

    private generateVerificationCode(): string {
        return randomInt(0, 1_000_000).toString().padStart(6, '0');
    }

    private async assertCanResend(sentAt: Date | null): Promise<void> {
        if (sentAt && Date.now() - sentAt.getTime() < 60_000) {
            throw new HttpException('Tunggu 60 detik sebelum meminta kode baru.', 429);
        }
    }

    private async sendCodeForUser(user: User, purpose: string): Promise<void> {
        await this.assertCanResend(user.verificationCodeSentAt);
        const code = this.generateVerificationCode();
        await this.userService.updateVerificationCode(user.id, purpose, await bcrypt.hash(code, 10), new Date(Date.now() + 3 * 60 * 1000));
        try {
            await this.emailService.sendVerificationCode(user.email, code, purpose);
        } catch {
            await this.userService.clearVerificationCode(user.id);
            throw new ServiceUnavailableException('Email gagal dikirim. Pastikan konfigurasi SMTP sudah benar lalu coba lagi.');
        }
    }

    private async validateEmailCode(email: string, code: string, purpose: string): Promise<User> {
        const user = await this.userService.findOneEmail(email);
        if (!user || !user.verificationCodeHash || user.verificationCodePurpose !== purpose) {
            throw new BadRequestException('Kode tidak valid untuk email atau proses ini.');
        }
        if (!user.verificationCodeExpiresAt || user.verificationCodeExpiresAt.getTime() <= Date.now()) {
            await this.userService.clearVerificationCode(user.id);
            throw new BadRequestException('Kode sudah kedaluwarsa. Minta kode baru.');
        }
        if (user.verificationCodeAttempts >= 5) {
            await this.userService.clearVerificationCode(user.id);
            throw new HttpException('Batas percobaan kode tercapai. Minta kode baru.', 429);
        }
        if (!await bcrypt.compare(code, user.verificationCodeHash)) {
            await this.userService.incrementVerificationCodeAttempts(user.id);
            if (user.verificationCodeAttempts + 1 >= 5) {
                await this.userService.clearVerificationCode(user.id);
                throw new HttpException('Batas percobaan kode tercapai. Minta kode baru.', 429);
            }
            throw new BadRequestException('Kode verifikasi salah.');
        }
        return user;
    }

    async validateUser(request): Promise<SignUpLocalResponseDto>{
        const user = await this.userService.findOneEmail(request.email)

        if(!user){
            throw new UnauthorizedException("email or password is invalid")
        } 

        if (!user.emailVerified) {
            throw new UnauthorizedException('Email belum diverifikasi. Periksa email untuk kode verifikasi.');
        }

        if(user.provider === providers.GOOGLE){
            throw new UnauthorizedException("this email only can signin with google")
        }

        if(!user.password){
            throw new UnauthorizedException("email or password is invalid")
        }

        const comparePw = await bcrypt.compare(request.password, user.password)

        if (!comparePw) {
            throw new UnauthorizedException("email or password is invalid")
        }

        return {
            id: user.id,
            email: user.email,
            role: user.role,
        }
    }

    async signin(request: SignInDataDto): Promise<SignInResponseDto>{

        const createToken = await this.createToken(request)

        return {
            id: request.id,
            email: request.email,
            role: request.role,
            accessToken: createToken.accessToken,
            refreshToken: createToken.refreshToken
        }
    }

    async refreshToken(userId: number, refreshTokenFromCookie: string){
        const user = await this.userService.findOneIdWithRefreshToken(userId)

        if(!user) throw new UnauthorizedException()

        if(!user.id || !user.hashedRefreshToken) throw new UnauthorizedException()

        const compareRefreshToken = await bcrypt.compare(refreshTokenFromCookie, user.hashedRefreshToken)

        if(!compareRefreshToken) throw new UnauthorizedException()

        const createToken = await this.createToken(user)

        return {
            accessToken: createToken.accessToken,
            refreshToken: createToken.refreshToken
        }
    }

    async getAuthenticatedUser(userId: number) {
        const user = await this.userService.findOneId(userId)
        if (!user) throw new UnauthorizedException()

        return {
            id: user.id,
            userId: user.id,
            email: user.email,
            role: user.role,
            farmer_group_id: user.farmer_group_id,
            group_status: user.group_status,
            pending_farmer_group_id: user.pending_farmer_group_id,
            provider: user.provider,
            created_at: user.created_at,
            updated_at: user.updated_at,
        }
    }

    async isCurrentRefreshToken(userId: number, refreshToken: string): Promise<boolean> {
        const user = await this.userService.findOneIdWithRefreshToken(userId)
        if (!user?.hashedRefreshToken) return false
        return bcrypt.compare(refreshToken, user.hashedRefreshToken)
    }

    async googleeSignin(user: User){
        let dbUser = await this.userService.findOneEmail(user.email)
        
        if(!dbUser){
            dbUser = await this.userService.createGoogle({
                email: user.email,
                provider: providers.GOOGLE
            })

        } else if(dbUser.provider !== providers.GOOGLE){
            throw new BadRequestException("email ini sudah terdaftar via password, silahkan coba untuk login manual")
        }

        const createToken = await this.createToken(dbUser)

        return {
            id: dbUser.id,
            email: dbUser.email,
            role: dbUser.role,
            accessToken: createToken.accessToken,
            refreshToken: createToken.refreshToken
        }
    }

    async promoteRole(id: number){
        await this.userService.update(id, {
            role: userRoles.ADMIN
        })

        return {
            message: `user with id ${id}, is promoted to admin`
        }
    }

    async signout(userId: number){
        await this.userService.update(userId, {
            hashedRefreshToken: null
        })

        return {
            message: `user with id ${userId}, succesfully signout`
        }
    }
}
