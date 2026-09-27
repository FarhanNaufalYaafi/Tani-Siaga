import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import passport, { strategies } from "passport";
import { Strategy } from "passport-jwt";
import { UserService } from "src/user/user.service";
import { cookieExtractor } from "../utils/cookie-extractor";
import { jwtPayload } from "../types/jwt-payload.type";
import { timingSafeEqual } from "crypto";
import { UpdateResult } from "typeorm";

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'rjwt'){
    constructor(private userService: UserService){
        super({
            jwtFromRequest: cookieExtractor('refresh_token'),
            secretOrKey: process.env.JWT_REFRESH_SECRET!,
            ignoreExpiration: false
        })
    }

    async validate(payload: jwtPayload){
        const user = await this.userService.findOneId(payload.sub)

        if(!user){
            throw new UnauthorizedException()
        }

        return {
            userId: user.id,
            email: user.email,
            role: user.role
        }
    }
}
