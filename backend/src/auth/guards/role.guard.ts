import { NotImplementedException, CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Observable } from "rxjs";
import { Reflector } from "@nestjs/core";

@Injectable()
export class RolesGuard implements CanActivate {
    constructor(private reflector: Reflector){}
    canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
        const requiredRoles = this.reflector.getAllAndMerge<string[]>(
            'roles',
            [
                context.getHandler(),
                context.getClass()
            ]
        )

        if (!requiredRoles) return true

        const request = context.switchToHttp().getRequest()

        const user = request.user 
        return requiredRoles.includes(user.role)

    }

}
