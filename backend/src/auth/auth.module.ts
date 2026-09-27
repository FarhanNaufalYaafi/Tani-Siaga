import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UserModule } from 'src/user/user.module';
import { LocalStrategy } from './strategies/local.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtSecretRequestType } from '@nestjs/jwt';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy';
import { GoogleStrategy } from './strategies/google.strategy';
import { JwtGuard } from './guards/jwt.guard';
import { NoActiveSessionGuard } from './guards/no-active-session.guard';
import { EmailService } from './email.service';
@Module({
  providers: [
    AuthService,
    LocalStrategy,
    JwtStrategy,
    JwtRefreshStrategy,
    GoogleStrategy,
    JwtGuard,
    NoActiveSessionGuard,
    EmailService,
   ],
  controllers: [AuthController],
  imports: [UserModule]
})
export class AuthModule {}
