import { ApiExpectationFailedResponse } from "@nestjs/swagger"
import { Expose } from "class-transformer"

export class SignInResponseDto {
    @Expose()
    id!: number

    @Expose()
    email!: string

    @Expose()
    role!: string

    @Expose()
    accessToken!: string

    @Expose()
    refreshToken!: string
}
