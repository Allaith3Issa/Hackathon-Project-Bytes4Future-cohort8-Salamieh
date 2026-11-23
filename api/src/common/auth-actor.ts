import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

export type ActorRole = 'admin' | 'customer' | 'marketer' | 'merchant';

export type AuthenticatedActor = {
  id: string;
  roles: ActorRole[];
};

type RequestWithActor = { user?: AuthenticatedActor };

const REQUIRED_ROLES = 'required-roles';

@Injectable()
export class AuthenticatedActorGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithActor>();
    if (
      !request.user ||
      typeof request.user.id !== 'string' ||
      !Array.isArray(request.user.roles)
    ) {
      throw new UnauthorizedException({
        statusCode: 401,
        code: 'AUTH_REQUIRED',
        message: 'A valid access token is required.',
      });
    }
    return true;
  }
}

@Injectable()
export class RequiredRolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles =
      this.reflector.getAllAndOverride<ActorRole[]>(REQUIRED_ROLES, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];
    const request = context.switchToHttp().getRequest<RequestWithActor>();
    if (!requiredRoles.some((role) => request.user?.roles.includes(role))) {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'FORBIDDEN',
        message: 'You do not have permission to perform this action.',
      });
    }
    return true;
  }
}

export const RequireRoles = (...roles: ActorRole[]) =>
  SetMetadata(REQUIRED_ROLES, roles);

export const CurrentActor = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedActor =>
    context.switchToHttp().getRequest<RequestWithActor>().user!,
);

