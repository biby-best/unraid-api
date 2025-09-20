import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { CookieAuthGuard } from '@app/unraid-api/file-manager/auth/cookie-auth.guard.js';
import { TokenBridgeService } from '@app/unraid-api/file-manager/auth/token-bridge.service.js';
import { FileManagerController } from '@app/unraid-api/file-manager/filemanager.controller.js';
import { FileManagerService } from '@app/unraid-api/file-manager/filemanager.service.js';
import { ProxyService } from '@app/unraid-api/file-manager/proxy/proxy.service.js';

@Module({
    imports: [ConfigModule],
    controllers: [FileManagerController],
    providers: [
        FileManagerService,
        // CookieAuthGuard,
        TokenBridgeService,
        ProxyService,
    ],
    exports: [FileManagerService, ProxyService],
})
export class FileManagerModule {}
