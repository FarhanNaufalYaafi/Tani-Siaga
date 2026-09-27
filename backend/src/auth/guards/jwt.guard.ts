import { Injectable, UnauthorizedException, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from '../auth.service';
import { JwtService } from '@nestjs/jwt';
import { cookieExtractor } from '../utils/cookie-extractor';
import { accessTokenCookieOptions, refreshTokenCookieOptions } from '../utils/auth-cookie-options';

@Injectable()
export class JwtGuard extends AuthGuard('jwt') {
	constructor(
		private authService: AuthService,
		private jwtService: JwtService,
	) {
		super();
	}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const req = context.switchToHttp().getRequest();
		const res = context.switchToHttp().getResponse();
		const accessToken = cookieExtractor('access_token')(req);

		if (accessToken) {
			try {
				this.jwtService.verify(accessToken, { secret: process.env.JWT_SECRET });
			} catch (error: any) {
				if (error?.name !== 'TokenExpiredError') throw new UnauthorizedException();
				return this.refreshSession(req, res);
			}
		} else if (cookieExtractor('refresh_token')(req)) {
			return this.refreshSession(req, res);
		}

		return (await super.canActivate(context)) as boolean;
	}

	private async refreshSession(req: any, res: any): Promise<boolean> {
		const refreshToken = cookieExtractor('refresh_token')(req);
		if (!refreshToken) throw new UnauthorizedException();

		try {
			const refreshPayload: any = this.jwtService.verify(refreshToken, {
				secret: process.env.JWT_REFRESH_SECRET,
			});
			const tokens = await this.authService.refreshToken(refreshPayload.sub, refreshToken);
			const accessPayload: any = this.jwtService.verify(tokens.accessToken, {
				secret: process.env.JWT_SECRET,
			});
			const user = await this.authService.getAuthenticatedUser(accessPayload.sub);

			res.cookie('access_token', tokens.accessToken, accessTokenCookieOptions());
			res.cookie('refresh_token', tokens.refreshToken, refreshTokenCookieOptions());
			req.user = user;
			return true;
		} catch {
			throw new UnauthorizedException('Sesi telah berakhir. Silakan masuk kembali.');
		}
	}
}
