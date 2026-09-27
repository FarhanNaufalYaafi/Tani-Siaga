import { PassportStrategy } from "@nestjs/passport";
import { strategies } from "passport";
import { Strategy } from "passport-jwt";
import { UserService } from "src/user/user.service";
import { cookieExtractor } from "../utils/cookie-extractor";
import { jwtPayload } from "../types/jwt-payload.type";
import { Injectable, UnauthorizedException } from "@nestjs/common";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy){
    constructor(private userService: UserService){
        super({
            jwtFromRequest: cookieExtractor('access_token'),
            secretOrKey: process.env.JWT_SECRET!,
            ignoreExpiration: false
        })
    }

    async validate (payload: jwtPayload){
        const user = await this.userService.findOneId(payload.sub)

        if (!user){
            throw new UnauthorizedException()
        }

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
}
