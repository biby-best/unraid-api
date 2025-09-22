import {
    Controller,
    Get,
    Logger,
    Param,
    Post,
    Query,
    Req,
    Res,
    UnauthorizedException,
} from '@nestjs/common';

import { AuthAction, Resource } from '@unraid/shared/graphql.model.js';
import { UsePermissions } from '@unraid/shared/use-permissions.directive.js';
import escapeHtml from 'escape-html';

import type { FastifyReply, FastifyRequest } from '@app/unraid-api/types/fastify.js';
import { Public } from '@app/unraid-api/auth/public.decorator.js';
import { OidcConfigPersistence } from '@app/unraid-api/graph/resolvers/sso/core/oidc-config.service.js';
import { OidcService } from '@app/unraid-api/graph/resolvers/sso/core/oidc.service.js';
import { OidcRequestHandler } from '@app/unraid-api/graph/resolvers/sso/utils/oidc-request-handler.util.js';
import { RestService } from '@app/unraid-api/rest/rest.service.js';
import { validateRedirectUri } from '@app/unraid-api/utils/redirect-uri-validator.js';

@Controller()
export class RestController {
    protected logger = new Logger(RestController.name);
    protected oidcLogger = new Logger('OidcRestController');

    constructor(
        private readonly restService: RestService,
        private readonly oidcService: OidcService,
        private readonly oidcConfig: OidcConfigPersistence
    ) {}

    @Get('/')
    @Public()
    async getRoot() {
        return 'OK';
    }

    @Post('/api/login')
    @Public()
    async login(@Req() req: any) {
        // Mock login response for FileBrowser
        return {
            token: 'mock-token-for-development',
            user: {
                id: 'dev-user',
                username: 'developer',
                roles: ['admin'],
                permissions: ['admin', 'read', 'write', 'delete', 'share', 'upload', 'download'],
            },
        };
    }

    @Post('/login')
    @Public()
    async loginForm(@Req() req: any, @Res() res: any) {
        // Handle the actual login form submission
        const { username, password } = req.body;

        // For development, accept any credentials
        if (username && password) {
            // Set a session cookie or token
            res.cookie('unraid-session', 'mock-session-token', {
                httpOnly: true,
                secure: false, // Set to true in production
                maxAge: 24 * 60 * 60 * 1000, // 24 hours
            });

            // Redirect to the file manager
            res.redirect('/filemanager/');
        } else {
            // Invalid credentials
            res.redirect('/login?error=invalid-credentials');
        }
    }

    @Get('/api/usage/')
    @Public()
    async getUsage() {
        // Mock usage data for development
        return {
            cpu: { usage: 25.5 },
            memory: { usage: 60.2 },
            disk: { usage: 45.8 },
        };
    }

    @Get('/api/resources/')
    @Public()
    async getResources() {
        // Mock resources data for development
        return {
            cpu: { cores: 8, usage: 25.5 },
            memory: { total: 16384, used: 9830, free: 6554 },
            disk: { total: 1000000, used: 458000, free: 542000 },
        };
    }

    @Get('/graphql/api/logs')
    @UsePermissions({
        action: AuthAction.READ_ANY,
        resource: Resource.LOGS,
    })
    async getLogs(@Res() res: FastifyReply) {
        try {
            const logStream = await this.restService.getLogs();
            return res.status(200).type('application/x-gtar').send(logStream);
        } catch (error: unknown) {
            this.logger.error(error);
            return res.status(500).send(`Error: Failed to get logs`);
        }
    }

    @Get('/graphql/api/customizations/:type')
    @UsePermissions({
        action: AuthAction.READ_ANY,
        resource: Resource.CUSTOMIZATIONS,
    })
    async getCustomizations(@Param('type') type: string, @Res() res: FastifyReply) {
        if (type !== 'banner' && type !== 'case') {
            throw new Error('Invalid Customization Type');
        }

        try {
            const customizationStream = await this.restService.getCustomizationStream(type);
            return res.status(200).type('image/png').send(customizationStream);
        } catch (error: unknown) {
            this.logger.error(error);
            return res.status(500).send(`Error: Failed to get customizations`);
        }
    }

    @Get(
        process.env.NODE_ENV === 'development'
            ? ['/graphql/api/auth/oidc/authorize/:providerId', '/api/auth/oidc/authorize/:providerId']
            : ['/graphql/api/auth/oidc/authorize/:providerId']
    )
    @Public()
    async oidcAuthorize(
        @Param('providerId') providerId: string,
        @Query('state') state: string,
        @Query('redirect_uri') redirectUri: string,
        @Req() req: FastifyRequest,
        @Res() res: FastifyReply
    ) {
        try {
            // Validate required parameters
            const params = OidcRequestHandler.validateAuthorizeParams(providerId, state, redirectUri);

            // IMPORTANT: Use the redirect_uri from query params directly
            // Do NOT parse headers or try to build/validate against headers
            // The frontend provides the complete redirect_uri
            if (!params.redirectUri) {
                return res.status(400).send('redirect_uri parameter is required');
            }

            // Security validation: validate redirect_uri with support for allowed origins
            const protocol = (req.headers['x-forwarded-proto'] as string) || 'http';
            const host = (req.headers['x-forwarded-host'] as string) || req.headers.host || req.hostname;

            // Get allowed origins from OIDC config
            const config = await this.oidcConfig.getConfig();
            const allowedOrigins = config?.defaultAllowedOrigins;

            // Validate the redirect URI using the centralized validator
            const validation = validateRedirectUri(
                params.redirectUri,
                protocol,
                host,
                this.oidcLogger,
                allowedOrigins
            );

            if (!validation.isValid) {
                this.oidcLogger.warn(`Invalid redirect_uri: ${validation.reason}`);
                return res
                    .status(400)
                    .send(
                        `Invalid redirect_uri: ${escapeHtml(params.redirectUri)}. ${escapeHtml(validation.reason || 'Unknown validation error')}. Please add this callback URI to Settings → Management Access → Allowed Redirect URIs`
                    );
            }

            // Handle authorization flow using the exact redirect_uri from query params
            const authUrl = await OidcRequestHandler.handleAuthorize(
                params.providerId,
                params.state,
                params.redirectUri,
                req,
                this.oidcService,
                this.oidcLogger
            );

            // Manually set redirect headers for better proxy compatibility
            res.status(302);
            res.header('Location', authUrl);
            return res.send();
        } catch (error: unknown) {
            this.oidcLogger.error(`OIDC authorize error for provider ${providerId}:`, error);

            // Log more details about the error
            if (error instanceof Error) {
                this.oidcLogger.error(`Error message: ${error.message}`);
                if (error.stack) {
                    this.oidcLogger.debug(`Stack trace: ${error.stack}`);
                }
            }

            return res.status(400).send('Invalid provider or configuration');
        }
    }

    @Get(
        process.env.NODE_ENV === 'development'
            ? ['/graphql/api/auth/oidc/callback', '/api/auth/oidc/callback']
            : ['/graphql/api/auth/oidc/callback']
    )
    @Public()
    async oidcCallback(
        @Query('code') code: string,
        @Query('state') state: string,
        @Req() req: FastifyRequest,
        @Res() res: FastifyReply
    ) {
        try {
            // Validate required parameters
            const params = OidcRequestHandler.validateCallbackParams(code, state);

            // Handle callback flow
            const result = await OidcRequestHandler.handleCallback(
                params.code,
                params.state,
                req,
                this.oidcService,
                this.oidcLogger
            );

            // Redirect to login page with the token in hash to keep it out of server logs
            const loginUrl = `/login#token=${encodeURIComponent(result.paddedToken)}`;

            // Manually set redirect headers for better proxy compatibility
            res.header('Cache-Control', 'no-store');
            res.header('Pragma', 'no-cache');
            res.header('Expires', '0');
            res.status(302);
            res.header('Location', loginUrl);
            return res.send();
        } catch (error: unknown) {
            this.oidcLogger.error(`OIDC callback error: ${error}`);

            // Use a generic error message to avoid leaking sensitive information
            const errorMessage = 'Authentication failed';

            // Log detailed error for debugging but don't expose to user
            if (error instanceof UnauthorizedException) {
                this.oidcLogger.debug(`UnauthorizedException occurred during OIDC callback`);
            } else if (error instanceof Error) {
                this.oidcLogger.debug(`Error during OIDC callback: ${error.message}`);
            }

            const loginUrl = `/login#error=${encodeURIComponent(errorMessage)}`;

            res.status(302);
            res.header('Location', loginUrl);
            return res.send();
        }
    }
}
