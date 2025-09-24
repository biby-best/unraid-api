import { All, Controller, Logger, Req, Res, UnauthorizedException, UseGuards } from '@nestjs/common';

import { Public } from '@app/unraid-api/auth/public.decorator.js';
import { CookieAuthGuard } from '@app/unraid-api/file-manager/auth/cookie-auth.guard.js';
import {
    TokenBridgeService,
    UnraidUser,
} from '@app/unraid-api/file-manager/auth/token-bridge.service.js';
import { UnraidAuthService } from '@app/unraid-api/file-manager/auth/unraid-auth.service.js';
import { ProxyService } from '@app/unraid-api/file-manager/proxy/proxy.service.js';

// Minimal request/response interfaces (app uses Fastify)
interface RequestLike {
    user?: any;
    method: string;
    url: string;
    headers: Record<string, any>;
}

interface ResponseLike {
    headersSent?: boolean;
    status?(code: number): ResponseLike;
    json?(payload: any): void;
    code?(statusCode: number): ResponseLike;
    send?(payload: any): void;
}

@Controller(['filemanager', 'static', 'api'])
@UseGuards(CookieAuthGuard)
export class FileManagerController {
    private readonly logger = new Logger(FileManagerController.name);

    constructor(
        private readonly proxyService: ProxyService,
        private readonly tokenBridgeService: TokenBridgeService,
        private readonly unraidAuthService: UnraidAuthService
    ) {}

    @All('*')
    async proxyRequest(@Req() req: any, @Res() res: any) {
        try {
            // Handle login form submission
            if (req.method === 'POST' && req.url === '/login') {
                const { username, password } = req.body;

                // Validate credentials against Unraid system
                if (username && password) {
                    const user = await this.unraidAuthService.authenticateUser(username, password);

                    if (user) {
                        // Check if user has file manager access
                        const hasAccess = await this.unraidAuthService.hasFileManagerAccess(user);

                        if (hasAccess) {
                            // Set a session cookie with user info
                            res.cookie('unraid-session', 'mock-session-token', {
                                httpOnly: true,
                                secure: false,
                                maxAge: 24 * 60 * 60 * 1000, // 24 hours
                            });

                            // Store user info in session (in production, use proper session storage)
                            res.cookie('unraid-user', JSON.stringify(user), {
                                httpOnly: true,
                                secure: false,
                                maxAge: 24 * 60 * 60 * 1000, // 24 hours
                            });

                            this.logger.log(
                                `User ${username} authenticated and granted file manager access`
                            );

                            // Redirect to the file manager
                            return res.redirect('/filemanager/');
                        } else {
                            this.logger.warn(
                                `User ${username} authenticated but denied file manager access`
                            );
                            return res.redirect('/login?error=insufficient-permissions');
                        }
                    } else {
                        this.logger.warn(`Authentication failed for user: ${username}`);
                        return res.redirect('/login?error=invalid-credentials');
                    }
                } else {
                    // Invalid credentials
                    return res.redirect('/login?error=invalid-credentials');
                }
            }

            // Handle specific API endpoints that the frontend needs
            if (req.url === '/api/usage/') {
                return res.send({
                    cpu: { usage: 25.5 },
                    memory: { usage: 60.2 },
                    disk: { usage: 45.8 },
                });
            }

            if (req.url === '/api/resources/') {
                return res.send({
                    cpu: { cores: 8, usage: 25.5 },
                    memory: { total: 16384, used: 9830, free: 6554 },
                    disk: { total: 1000000, used: 458000, free: 542000 },
                });
            }

            // Get authenticated user from Unraid
            const user = req.user as UnraidUser;

            if (!user) {
                throw new UnauthorizedException('User not authenticated');
            }

            // Validate user has access to file manager
            if (!this.tokenBridgeService.validateFileBrowserAccess(user)) {
                throw new UnauthorizedException('Insufficient permissions for file manager');
            }

            await this.proxyToFileBrowser(req, res);
        } catch (error) {
            this.logger.error('Proxy request failed', error);

            if (error instanceof UnauthorizedException) {
                return res.code(403).send({
                    error: 'Access denied',
                    message: error.message,
                });
            } else {
                return res.code(500).send({
                    error: 'FileManager proxy error',
                    message: error instanceof Error ? error.message : 'Unknown error',
                });
            }
        }
    }

    private async proxyToFileBrowser(req: any, res: any): Promise<void> {
        const fileManagerUrl = this.proxyService.getFileManagerUrl();

        // Handle both /filemanager and /static routes
        let targetPath = req.url;
        if (targetPath.startsWith('/filemanager/static')) {
            // FileBrowser static assets: /filemanager/static/assets/file.js -> /static/assets/file.js
            targetPath = targetPath.replace(/^\/filemanager/, '');
        } else if (targetPath.startsWith('/filemanager')) {
            // Regular FileBrowser routes: /filemanager/api/... -> /api/...
            targetPath = targetPath.replace(/^\/filemanager/, '') || '/';
        } else if (targetPath.startsWith('/static')) {
            // Direct static asset requests: /static/assets/file.js -> /static/assets/file.js
            // No change needed for static paths
        }

        const targetUrl = `${fileManagerUrl}${targetPath}`;

        this.logger.debug(`Proxying ${req.method} ${req.url} to ${targetUrl}`);

        try {
            // Build headers for the proxy request
            const headers: Record<string, string> = {};

            // Copy important headers
            if (req.headers.authorization) headers.authorization = req.headers.authorization;
            if (req.headers['content-type']) headers['content-type'] = req.headers['content-type'];
            if (req.headers['content-length']) headers['content-length'] = req.headers['content-length'];
            if (req.headers.accept) headers.accept = req.headers.accept;
            if (req.headers['user-agent']) headers['user-agent'] = req.headers['user-agent'];

            // Add forwarded headers
            headers['x-forwarded-host'] = req.headers.host || '';
            headers['x-forwarded-proto'] = req.protocol || 'http';
            headers['x-real-ip'] = req.ip || '';

            // Build fetch options
            const fetchOptions: RequestInit = {
                method: req.method,
                headers,
                signal: AbortSignal.timeout(30000), // 30 second timeout
            };

            // Add body for POST/PUT/PATCH requests
            if (['POST', 'PUT', 'PATCH'].includes(req.method.toUpperCase())) {
                fetchOptions.body = JSON.stringify(req.body);
            }

            // Make the request to FileBrowser
            const response = await fetch(targetUrl, fetchOptions);

            // Copy response headers
            response.headers.forEach((value, key) => {
                // Skip some headers that might cause issues with proxying
                if (
                    !['transfer-encoding', 'connection', 'keep-alive', 'content-encoding'].includes(
                        key.toLowerCase()
                    )
                ) {
                    res.header(key, value);
                }
            });

            // Set status code
            res.code(response.status);

            // Handle different content types
            const contentType = response.headers.get('content-type') || '';

            this.logger.debug(`Response content-type: ${contentType} for ${req.url}`);

            if (contentType.includes('application/json')) {
                const data = await response.json();
                return res.send(data);
            } else if (contentType.includes('text/html')) {
                // Rewrite HTML to fix asset paths
                const html = await response.text();
                const rewrittenHtml = this.rewriteHtmlPaths(html);
                return res.send(rewrittenHtml);
            } else if (
                contentType.includes('application/javascript') ||
                contentType.includes('text/javascript') ||
                req.url.endsWith('.js')
            ) {
                // Handle JavaScript files specifically
                const text = await response.text();
                this.logger.debug(`JS file size: ${text.length} bytes for ${req.url}`);
                if (text.length === 0) {
                    this.logger.warn(`Empty JS response for ${req.url}`);
                }
                res.header('Content-Type', 'application/javascript; charset=utf-8');
                return res.send(text);
            } else if (contentType.includes('text/css') || req.url.endsWith('.css')) {
                // Handle CSS files specifically
                const text = await response.text();
                res.header('Content-Type', 'text/css; charset=utf-8');
                return res.send(text);
            } else if (contentType.includes('text/')) {
                const text = await response.text();
                return res.send(text);
            } else {
                // Binary content - stream it properly
                const arrayBuffer = await response.arrayBuffer();
                const buffer = Buffer.from(arrayBuffer);
                this.logger.debug(`Binary file size: ${buffer.length} bytes for ${req.url}`);
                return res.send(buffer);
            }
        } catch (error) {
            this.logger.error(`Proxy error for ${req.method} ${req.url}:`, error);
            throw error;
        }
    }

    private rewriteHtmlPaths(html: string): string {
        // Rewrite absolute paths to be relative to /filemanager
        return html
            .replace(/href="\/static\//g, 'href="/filemanager/static/')
            .replace(/src="\/static\//g, 'src="/filemanager/static/')
            .replace(/href="\/api\//g, 'href="/filemanager/api/')
            .replace(/src="\/api\//g, 'src="/filemanager/api/')
            .replace(/"\/favicon\.ico"/g, '"/filemanager/favicon.ico"')
            .replace(/"\/manifest\.json"/g, '"/filemanager/manifest.json"');
    }
}
