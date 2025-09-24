import {
    CanActivate,
    ExecutionContext,
    Injectable,
    Logger,
    UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { IS_PUBLIC_ENDPOINT_KEY } from '@app/unraid-api/auth/public.decorator.js';

@Injectable()
export class CookieAuthGuard implements CanActivate {
    private readonly logger = new Logger(CookieAuthGuard.name);

    constructor(private reflector: Reflector) {}

    canActivate(context: ExecutionContext): boolean | Promise<boolean> {
        const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_ENDPOINT_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);

        if (isPublic) {
            return true;
        }

        const request = context.switchToHttp().getRequest();
        const cookies = request.cookies || {};
        const sessionToken = cookies['unraid-session'];

        this.logger.debug('Cookie auth check:', {
            cookies,
            sessionToken,
            hasCookies: !!cookies,
            cookieKeys: Object.keys(cookies),
        });

        if (!sessionToken) {
            this.logger.warn('No session token found in request');
            throw new UnauthorizedException('No user session found');
        }

        // For demo purposes, accept any session token
        // In production, this should validate the token properly
        if (sessionToken === 'mock-session-token') {
            // Create a mock user for the request
            const user = {
                id: 'user-admin',
                username: 'admin',
                roles: ['admin'],
                permissions: ['read', 'write', 'delete', 'admin'],
            };

            // Attach user to request
            request.user = user;
            return true;
        }

        this.logger.warn('Invalid session token');
        throw new UnauthorizedException('Invalid session');
    }
}
