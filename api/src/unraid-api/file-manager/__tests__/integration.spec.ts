import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CookieAuthGuard } from '@app/unraid-api/file-manager/auth/cookie-auth.guard.js';
import { TokenBridgeService } from '@app/unraid-api/file-manager/auth/token-bridge.service.js';
import { FileManagerController } from '@app/unraid-api/file-manager/filemanager.controller.js';
import { FileManagerService } from '@app/unraid-api/file-manager/filemanager.service.js';
import { ProxyService } from '@app/unraid-api/file-manager/proxy/proxy.service.js';

describe('FileManagerModule', () => {
    let service: FileManagerService;
    let controller: FileManagerController;
    let proxyService: ProxyService;
    let tokenBridgeService: TokenBridgeService;
    let configService: ConfigService;

    beforeEach(async () => {
        const mockConfigService = {
            get: vi.fn((key: string, defaultValue?: any) => {
                const config = {
                    FILEMANAGER_ENABLED: false, // Disable to avoid starting actual process
                    FILEMANAGER_PORT: 8080,
                    FILEMANAGER_ROOT: '/mnt/user',
                    FILEMANAGER_BINARY: '/usr/local/emhttp/plugins/unraid-api/filebrowser/filebrowser',
                    FILEMANAGER_CONFIG: '/boot/config/plugins/unraid-api/filebrowser/config.json',
                    FILEMANAGER_DATABASE: '/boot/config/plugins/unraid-api/filebrowser/database.db',
                    FILEMANAGER_THUMBNAILS: true,
                    FILEMANAGER_SHARING: true,
                };
                return config[key] ?? defaultValue;
            }),
        };

        const module: TestingModule = await Test.createTestingModule({
            controllers: [FileManagerController],
            providers: [
                FileManagerService,
                CookieAuthGuard,
                TokenBridgeService,
                ProxyService,
                {
                    provide: ConfigService,
                    useValue: mockConfigService,
                },
            ],
        }).compile();

        service = module.get<FileManagerService>(FileManagerService);
        controller = module.get<FileManagerController>(FileManagerController);
        proxyService = module.get<ProxyService>(ProxyService);
        tokenBridgeService = module.get<TokenBridgeService>(TokenBridgeService);
        configService = module.get<ConfigService>(ConfigService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
        expect(controller).toBeDefined();
        expect(proxyService).toBeDefined();
        expect(tokenBridgeService).toBeDefined();
    });

    it('should get file manager url', () => {
        const url = service.getFileManagerUrl();
        expect(url).toBe('http://localhost:8080');
    });

    it('should report service not running when disabled', () => {
        const isRunning = service.isServiceRunning();
        expect(isRunning).toBe(false);
    });

    it('should handle proxy request with authenticated user', async () => {
        const mockUser = { username: 'testuser', permissions: ['filemanager'] };
        const mockReq = {
            user: mockUser,
            method: 'GET',
            url: '/filemanager/api/files',
            headers: {},
        };
        const mockRes = {
            headersSent: false,
            status: vi.fn().mockReturnThis(),
            json: vi.fn(),
        };

        // Mock the token bridge validation
        vi.spyOn(tokenBridgeService, 'validateFileBrowserAccess').mockReturnValue(true);

        // Mock the proxy middleware
        const mockProxyMiddleware = vi.fn((req, res, next) => {
            // Simulate successful proxy
            next();
        });
        vi.spyOn(proxyService, 'createProxyMiddleware').mockReturnValue(mockProxyMiddleware);

        await controller.proxyRequest(mockReq as any, mockRes as any);

        expect(tokenBridgeService.validateFileBrowserAccess).toHaveBeenCalledWith(mockUser);
        expect(proxyService.createProxyMiddleware).toHaveBeenCalled();
        expect(mockProxyMiddleware).toHaveBeenCalled();
    });

    it('should reject proxy request without user', async () => {
        const mockReq = {
            user: null,
            method: 'GET',
            url: '/filemanager/api/files',
            headers: {},
        };
        const mockRes = {
            headersSent: false,
            status: vi.fn().mockReturnThis(),
            json: vi.fn(),
        };

        await controller.proxyRequest(mockReq as any, mockRes as any);

        expect(mockRes.status).toHaveBeenCalledWith(403);
        expect(mockRes.json).toHaveBeenCalledWith({
            error: 'Access denied',
            message: 'User not authenticated',
        });
    });

    it('should reject proxy request with insufficient permissions', async () => {
        const mockUser = { username: 'testuser', permissions: [] };
        const mockReq = {
            user: mockUser,
            method: 'GET',
            url: '/filemanager/api/files',
            headers: {},
        };
        const mockRes = {
            headersSent: false,
            status: vi.fn().mockReturnThis(),
            json: vi.fn(),
        };

        // Mock the token bridge validation to fail
        vi.spyOn(tokenBridgeService, 'validateFileBrowserAccess').mockReturnValue(false);

        await controller.proxyRequest(mockReq as any, mockRes as any);

        expect(mockRes.status).toHaveBeenCalledWith(403);
        expect(mockRes.json).toHaveBeenCalledWith({
            error: 'Access denied',
            message: 'Insufficient permissions for file manager',
        });
    });

    it('should handle proxy middleware errors', async () => {
        const mockUser = { username: 'testuser', permissions: ['filemanager'] };
        const mockReq = {
            user: mockUser,
            method: 'GET',
            url: '/filemanager/api/files',
            headers: {},
        };
        const mockRes = {
            headersSent: false,
            status: vi.fn().mockReturnThis(),
            json: vi.fn(),
        };

        // Mock the token bridge validation
        vi.spyOn(tokenBridgeService, 'validateFileBrowserAccess').mockReturnValue(true);

        // Mock the proxy middleware to call next with error
        const mockError = new Error('Proxy error');
        const mockProxyMiddleware = vi.fn((req, res, next) => {
            next(mockError);
        });
        vi.spyOn(proxyService, 'createProxyMiddleware').mockReturnValue(mockProxyMiddleware);

        await controller.proxyRequest(mockReq as any, mockRes as any);

        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.json).toHaveBeenCalledWith({
            error: 'FileManager proxy error',
            message: 'Proxy error',
        });
    });
});
