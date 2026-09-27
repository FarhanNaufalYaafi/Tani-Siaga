import { isStringObject } from "util/types"
import {IsEmail, IsStrongPassword} from 'class-validator'

export class SignUpLocalDto {
    @IsEmail()
    email!: string
    
    @IsStrongPassword()
    password!: string
}
