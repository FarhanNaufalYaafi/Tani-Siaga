import { StringifyOptions } from "querystring";
import { providers } from "../enum/provider.enum";
import { IsEmail } from "class-validator";

export class SignUpGoogleDto {
    @IsEmail()
    email!: string

    provider!: providers.GOOGLE
}
