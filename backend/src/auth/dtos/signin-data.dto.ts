import { Expose } from "class-transformer"
import { IsEmail, IsNumber } from "class-validator"
import { userRoles } from "src/user/enum/user-roles.enum"

export class SignInDataDto {
    @IsNumber()
    @Expose()
    id!: number

    @IsEmail()
    @Expose()
    email!: string

    @Expose()
    role!: userRoles
}
