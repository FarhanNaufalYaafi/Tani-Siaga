import { CanActivate, ConflictException, ExecutionContext, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from '../auth.service';
import { cookieExtractor } from '../utils/cookie-extractor';

const ACTIVE_SESSION_MESSAGE = 'Anda masih login. Silakan sign out terlebih dahulu sebelum menggunakan akun lain.';

@Injectable()
export class NoActiveSessionGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const accessToken = cookieExtractor('access_token')(request);

    if (accessToken) {
      try {
        this.jwtService.verify(accessToken, { secret: process.env.JWT_SECRET });
        throw new ConflictException(ACTIVE_SESSION_MESSAGE);
      } catch (error) {
        if (error instanceof ConflictException) throw error;
      }
    }

    const refreshToken = cookieExtractor('refresh_token')(request);
    if (!refreshToken) return true;

    let payload: { sub: number };
    try {
      payload = this.jwtService.verify(refreshToken, { secret: process.env.JWT_REFRESH_SECRET });
    } catch {
      return true;
    }

    if (await this.authService.isCurrentRefreshToken(payload.sub, refreshToken)) {
      throw new ConflictException(ACTIVE_SESSION_MESSAGE);
    }

    return true;
  }
}