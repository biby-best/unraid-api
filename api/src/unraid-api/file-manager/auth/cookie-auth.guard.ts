import {
    CanActivate,
    ExecutionContext,
    Injectable,
    Logger,
    UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';

import { firstValueFrom, isObservable } from 'rxjs';

import { UserCookieStrategy } from '@app/unraid-api/auth/cookie.strategy.js';
import { ServerHeaderStrategy } from '@app/unraid-api/auth/header.strategy.js';
import { LocalSessionStrategy } from '@app/unraid-api/auth/local-session.strategy.js';
import { IS_PUBLIC_ENDPOINT_KEY } from '@app/unraid-api/auth/public.decorator.js';

@Injectable()
export class CookieAuthGuard
    extends AuthGuard([ServerHeaderStrategy.key, LocalSessionStrategy.key, UserCookieStrategy.key])
    implements CanActivate
{
    private readonly logger = new Logger(CookieAuthGuard.name);

    constructor(private reflector: Reflector) {
        super();
    }

    canActivate(context: ExecutionContext): boolean | Promise<boolean> {
        const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_ENDPOINT_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);

        if (isPublic) {
            return true;
        }

        const result = super.canActivate(context) as any;
        if (isObservable(result)) {
            return firstValueFrom(result) as Promise<boolean>;
        }
        return result;
    }

    handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
        if (err) {
            this.logger.error('Authentication error', err);
            throw new UnauthorizedException('Authentication failed');
        }

        if (!user) {
            this.logger.warn('No user found in request');
            throw new UnauthorizedException('User not authenticated');
        }

        // Ensure user has required permissions for file manager access
        if (!this.hasFileManagerAccess(user)) {
            this.logger.warn(`User ${user.username} denied access to file manager`);
            throw new UnauthorizedException('Insufficient permissions for file manager');
        }

        return user;
    }

    private hasFileManagerAccess(user: any): boolean {
        // Check if user has admin role or share permissions
        const roles = user.roles || [];
        return roles.includes('admin') || roles.includes('share.read') || roles.includes('share.write');
    }
}
