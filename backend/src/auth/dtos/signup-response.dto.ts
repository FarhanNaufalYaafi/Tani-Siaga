import { Expose } from "class-transformer"
import { userRoles } from "src/user/enum/user-roles.enum"

export class SignUpLocalResponseDto{
    @Expose()
    id!: number

    @Expose()
    email!: string

    @Expose()
    role!: userRoles
}
