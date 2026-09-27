import { User } from "src/user/entities/user.entity"
import { providers } from "src/user/enum/provider.enum"
import { userRoles } from "src/user/enum/user-roles.enum"

export type jwtPayload = {
    sub: number,
    email: string,
    role: userRoles
}
