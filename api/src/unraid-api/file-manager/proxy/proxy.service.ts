import { Injectable, Logger } from '@nestjs/common';

import { createProxyMiddleware, RequestHandler } from 'http-proxy-middleware';

// Correct relative path to auth services
import {
    TokenBridgeService,
    UnraidUser,
} from '@app/unraid-api/file-manager/auth/token-bridge.service.js';
import { FileManagerService } from '@app/unraid-api/file-manager/filemanager.service.js';

// Using Fastify in the main app; define minimal request/response shapes for typing
interface RequestLike {
    method: string;
    url: string;
    headers: Record<string, any>;
    protocol?: string;
    ip?: string;
    ips?: string[];
    user?: any;
}

interface ResponseLike {
    headersSent?: boolean;
    setHeader(key: string, value: string): void;
    status(code: number): ResponseLike;
    json(payload: any): void;
}

@Injectable()
export class ProxyService {
    private readonly logger = new Logger(ProxyService.name);
    private proxyMiddleware: RequestHandler | null = null;

    constructor(
        private readonly fileManagerService: FileManagerService,
        private readonly tokenBridgeService: TokenBridgeService
    ) {}

    /**
     * Create and configure the proxy middleware for FileBrowser
     */
    createProxyMiddleware(): RequestHandler {
        if (this.proxyMiddleware) {
            return this.proxyMiddleware;
        }

        const fileManagerUrl = this.fileManagerService.getFileManagerUrl();

        this.proxyMiddleware = createProxyMiddleware({
            target: fileManagerUrl,
            changeOrigin: true,
            ws: true, // Enable WebSocket proxying
            logLevel: 'debug',

            // Path rewriting
            pathRewrite: {
                '^/filemanager': '', // Remove /filemanager prefix when proxying
            },

            // Request transformation
            onProxyReq: (proxyReq, req, res) => {
                this.onProxyRequest(proxyReq, req as RequestLike, res as ResponseLike);
            },

            // Response transformation
            onProxyRes: (proxyRes, req, res) => {
                this.onProxyResponse(proxyRes, req as RequestLike, res as ResponseLike);
            },

            // Error handling
            onError: (err, req, res) => {
                this.onProxyError(err, req as RequestLike, res as ResponseLike);
            },

            // WebSocket handling
            onProxyReqWs: (proxyReq, req, socket, options, head) => {
                this.onWebSocketRequest(proxyReq, req as RequestLike, socket, options, head);
            },
        });

        return this.proxyMiddleware;
    }

    /**
     * Handle proxy requests - add authentication headers
     */
    private onProxyRequest(proxyReq: any, req: RequestLike, res: ResponseLike): void {
        try {
            const user = req.user as UnraidUser;

            if (user) {
                // Add authentication headers for FileBrowser
                const authHeaders = this.tokenBridgeService.buildFileBrowserAuthHeaders(user);

                Object.entries(authHeaders).forEach(([key, value]) => {
                    proxyReq.setHeader(key, value);
                });

                this.logger.debug(
                    `Proxying request for user ${user.username}: ${req.method} ${req.url}`
                );
            } else {
                this.logger.warn('No user found in request for proxy');
            }

            // Add forwarded headers
            proxyReq.setHeader('X-Forwarded-Host', req.headers.host || '');
            proxyReq.setHeader('X-Forwarded-Proto', req.protocol || 'http');
            proxyReq.setHeader('X-Real-IP', req.ip || '');
            proxyReq.setHeader('X-Forwarded-For', req.ips?.join(', ') || req.ip || '');
        } catch (error) {
            this.logger.error('Error in proxy request handler', error);
        }
    }

    /**
     * Handle proxy responses - can be used for logging or response modification
     */
    private onProxyResponse(proxyRes: any, req: RequestLike, res: ResponseLike): void {
        try {
            const user = req.user as UnraidUser;
            const username = user?.username || 'anonymous';

            this.logger.debug(
                `Proxy response: ${proxyRes.statusCode} for ${req.method} ${req.url} (user: ${username})`
            );

            // Add security headers
            res.setHeader('X-Frame-Options', 'SAMEORIGIN');
            res.setHeader('X-Content-Type-Options', 'nosniff');
        } catch (error) {
            this.logger.error('Error in proxy response handler', error);
        }
    }

    /**
     * Handle proxy errors
     */
    private onProxyError(err: Error, req: RequestLike, res: ResponseLike): void {
        this.logger.error(`Proxy error for ${req.method} ${req.url}:`, err);

        if (!res.headersSent) {
            res.status(500).json({
                error: 'FileManager proxy error',
                message: 'Failed to proxy request to file manager service',
            });
        }
    }

    /**
     * Handle WebSocket proxy requests
     */
    private onWebSocketRequest(
        proxyReq: any,
        req: RequestLike,
        socket: any,
        options: any,
        head: any
    ): void {
        try {
            const user = req.user as UnraidUser;

            if (user) {
                // Add authentication headers for WebSocket connections
                const authHeaders = this.tokenBridgeService.buildFileBrowserAuthHeaders(user);

                Object.entries(authHeaders).forEach(([key, value]) => {
                    proxyReq.setHeader(key, value);
                });

                this.logger.debug(`WebSocket proxy for user ${user.username}: ${req.url}`);
            } else {
                this.logger.warn('No user found in WebSocket request');
            }
        } catch (error) {
            this.logger.error('Error in WebSocket proxy handler', error);
        }
    }

    /**
     * Get the current proxy middleware instance
     */
    getProxyMiddleware(): RequestHandler | null {
        return this.proxyMiddleware;
    }

    /**
     * Reset the proxy middleware (useful for configuration changes)
     */
    resetProxyMiddleware(): void {
        this.proxyMiddleware = null;
        this.logger.log('Proxy middleware reset');
    }

    /**
     * Get the FileBrowser service URL
     */
    getFileManagerUrl(): string {
        return this.fileManagerService.getFileManagerUrl();
    }
}
