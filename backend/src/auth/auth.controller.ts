import { BadRequestException, Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Req, Res, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { SignUpLocalDto } from 'src/user/dtos/signup-local.dto';
import { Serialize } from 'src/interceptors/serialize.interceptor';
import { VerifyEmailDto } from './dtos/verify-email.dto';
import { ForgotPasswordDto } from './dtos/forgot-password.dto';
import { ResetPasswordDto } from './dtos/reset-password.dto';
import { ChangeProfilePasswordDto } from './dtos/change-profile-password.dto';
import { SignInDataDto } from './dtos/signin-data.dto';
import { SignInResponseDto } from './dtos/signin-response.dto';
import { JwtGuard } from './guards/jwt.guard';
import { LocalGuard } from './guards/local.guard';
import { CurrentUser } from './decorator/current-user.decorator';
import { User } from 'src/user/entities/user.entity';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';
import { GoogleGuard } from './guards/google.guard';
import { HTTP_CODE_METADATA } from '@nestjs/common/constants';
import { RolesGuard } from './guards/role.guard';
import { Roles } from './decorator/role.decorator';
import { accessTokenCookieOptions, refreshTokenCookieOptions } from './utils/auth-cookie-options';
import { NoActiveSessionGuard } from './guards/no-active-session.guard';

@Controller('auth')
export class AuthController {
    constructor(
        private authService: AuthService,

    ){}

    @Post('signup')
    @HttpCode(200)
    @UseGuards(NoActiveSessionGuard)
    async signup(@Body() request: SignUpLocalDto){
        return await this.authService.signup(request)
    }

    @Post('verify-email')
    @HttpCode(200)
    @UseGuards(NoActiveSessionGuard)
    async verifyEmail(@Body() dto: VerifyEmailDto, @Res({ passthrough: true }) res) {
        const result = await this.authService.verifySignupEmail(dto.email, dto.code);
        res.cookie('access_token', result.accessToken, accessTokenCookieOptions());
        res.cookie('refresh_token', result.refreshToken, refreshTokenCookieOptions());
        return { id: result.id, email: result.email, role: result.role };
    }

    @Post('forgot-password')
    @HttpCode(200)
    async forgotPassword(@Body() dto: ForgotPasswordDto) {
        return this.authService.sendPasswordResetCode(dto.email);
    }

    @Post('verify-reset-code')
    @HttpCode(200)
    async verifyResetCode(@Body() dto: VerifyEmailDto) {
        return this.authService.verifyPasswordResetCode(dto.email, dto.code);
    }

    @Post('reset-password')
    @HttpCode(200)
    async resetPassword(@Body() dto: ResetPasswordDto, @Res({ passthrough: true }) res) {
        const result = await this.authService.resetPassword(dto.email, dto.code, dto.password, dto.confirmPassword);
        res.clearCookie('access_token', { path: '/' });
        res.clearCookie('refresh_token', { path: '/' });
        return result;
    }

    @Post('profile/password-code')
    @HttpCode(200)
    @UseGuards(JwtGuard)
    async sendProfilePasswordCode(@Body() body: { currentPassword: string }, @Req() req) {
        return this.authService.sendProfilePasswordCode(req.user.userId, body.currentPassword);
    }

    @Patch('profile/password')
    @HttpCode(200)
    @UseGuards(JwtGuard)
    async changeProfilePassword(@Body() dto: ChangeProfilePasswordDto, @Req() req) {
        return this.authService.changeProfilePassword(req.user.userId, dto.currentPassword, dto.code, dto.password, dto.confirmPassword);
    }

    @Post('signin')
    @HttpCode(200)
    @Serialize(SignInResponseDto)
    @UseGuards(NoActiveSessionGuard, LocalGuard)
    async signin(
        @Body() dto: SignUpLocalDto,
        @Req() req,
        @Res({passthrough: true}) res
    ){
        const result = await this.authService.signin(req.user)
        

        res.cookie('access_token', result.accessToken, accessTokenCookieOptions())
        res.cookie('refresh_token', result.refreshToken, refreshTokenCookieOptions())

        return {
            id: result.id,
            email: result.email,
            role: result.role
        }
    }

    @Get('me')
    @HttpCode(200)
    @UseGuards(JwtGuard)
    async me(@CurrentUser() user: User){
        return user
    }

    @Post('refresh')
    @UseGuards(JwtRefreshGuard)
    async refresh(
        @Req() req,
        @Res({passthrough: true}) res
    ){
        const refreshTokenFromCookie = req.cookies.refresh_token
        const result = await this.authService.refreshToken(
            req.user.userId,
            refreshTokenFromCookie
        )

        res.cookie('access_token', result.accessToken, accessTokenCookieOptions())
        res.cookie('refresh_token', result.refreshToken, refreshTokenCookieOptions())

        return {
            success: true
        }
    }

    @Get('google')
    @HttpCode(200)
    @UseGuards(NoActiveSessionGuard, GoogleGuard)
    async google(){}

    @Get('google/callback')
    @HttpCode(200)
    @UseGuards(NoActiveSessionGuard, GoogleGuard)
    async googleCallback(
        @Req() req,
        @Res() res,
    ){
        const result = await this.authService.googleeSignin(req.user)
        
        res.cookie('access_token', result.accessToken, accessTokenCookieOptions())
        res.cookie('refresh_token', result.refreshToken, refreshTokenCookieOptions())

        return res.redirect('http://localhost:5173/dashboard')
    }

    @Patch("promote/:id")
    @HttpCode(HttpStatus.ACCEPTED)
    @UseGuards(JwtGuard, RolesGuard)
    @Roles('admin')
    promoteToAdmin(@Param("id") id: string){
        return this.authService.promoteRole(
            Number(id)
        )
    }

    @Post("signout")
    @UseGuards(JwtGuard)
    async signout(
        @Req() req,
        @Res({passthrough: true}) res
    ){
        const result = await this.authService.signout(req.user.userId)

        res.clearCookie('access_token', { path: '/' })
        res.clearCookie('refresh_token', { path: '/' })

        return result
  }
}
