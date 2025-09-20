import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChildProcess, spawn } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';

@Injectable()
export class FileManagerService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(FileManagerService.name);
    private fileManagerProcess: ChildProcess | null = null;
    private fileManagerUrl: string;

    constructor(private readonly configService: ConfigService) {
        const port = this.configService.get('FILEMANAGER_PORT', 8080);
        this.fileManagerUrl = `http://localhost:${port}`;
    }

    async onModuleInit() {
        const enabled = this.configService.get('FILEMANAGER_ENABLED', true);

        if (!enabled) {
            this.logger.log('FileManager is disabled');
            return;
        }

        try {
            await this.ensureFileBrowserBinary();
            await this.startFileBrowser();
            await this.waitForService();
            this.logger.log('FileBrowser service started successfully');
        } catch (error) {
            this.logger.error('Failed to start FileBrowser service', error);
            throw error;
        }
    }

    async onModuleDestroy() {
        if (this.fileManagerProcess) {
            this.logger.log('Stopping FileBrowser service');
            this.fileManagerProcess.kill('SIGTERM');

            // Wait for process to exit gracefully
            await new Promise((resolve) => {
                this.fileManagerProcess?.on('exit', () => resolve(void 0));
                setTimeout(resolve, 5000); // Force kill after 5 seconds
            });

            if (this.fileManagerProcess) {
                this.fileManagerProcess.kill('SIGKILL');
            }
        }
    }

    private async ensureFileBrowserBinary(): Promise<void> {
        const binaryPath = this.getFileBrowserBinaryPath();

        try {
            await fs.access(binaryPath);
            this.logger.log('FileBrowser binary found');
        } catch {
            throw new Error(
                `FileBrowser binary not found at ${binaryPath}. Please ensure it's installed.`
            );
        }
    }

    private async startFileBrowser(): Promise<void> {
        const binaryPath = this.getFileBrowserBinaryPath();
        const configPath = this.getFileBrowserConfigPath();
        const databasePath = this.getFileBrowserDatabasePath();
        const port = this.configService.get('FILEMANAGER_PORT', 8080);

        // Ensure config directory exists
        await fs.mkdir(path.dirname(configPath), { recursive: true });

        const rootPath = this.configService.get('FILEMANAGER_ROOT', '/mnt/user');
        const args = [
            '--port',
            port.toString(),
            '--root',
            rootPath, // Default or overridden root path
            '--database',
            databasePath,
            '--config',
            configPath,
            '--noauth', // Disable built-in auth, use our proxy
            '--log',
            'stdout',
        ];

        // Note: --enable-thumbnails and --enable-sharing flags don't exist in FileBrowser
        // These features are enabled by default or configured via the web UI

        this.logger.log(`Starting FileBrowser with args: ${args.join(' ')}`);

        this.fileManagerProcess = spawn(binaryPath, args, {
            stdio: ['pipe', 'pipe', 'pipe'],
            env: { ...process.env, PWD: '/tmp' },
        });

        // Log stdout and stderr
        this.fileManagerProcess.stdout?.on('data', (data) => {
            this.logger.debug(`FileBrowser: ${data.toString().trim()}`);
        });

        this.fileManagerProcess.stderr?.on('data', (data) => {
            this.logger.error(`FileBrowser Error: ${data.toString().trim()}`);
        });

        this.fileManagerProcess.on('exit', (code, signal) => {
            this.logger.log(`FileBrowser process exited with code ${code} and signal ${signal}`);
        });
    }

    private async waitForService(maxAttempts = 30): Promise<void> {
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                const response = await fetch(`${this.fileManagerUrl}/`, {
                    signal: AbortSignal.timeout(1000),
                });

                if (response.status < 500) {
                    this.logger.log('FileBrowser service is ready');
                    return;
                }
            } catch {
                // Service not ready yet
            }

            if (attempt === maxAttempts) {
                throw new Error('FileBrowser service failed to start within timeout');
            }

            await new Promise((resolve) => setTimeout(resolve, 1000));
        }
    }

    getFileManagerUrl(): string {
        return this.fileManagerUrl;
    }

    isServiceRunning(): boolean {
        return this.fileManagerProcess !== null && !this.fileManagerProcess.killed;
    }

    private getFileBrowserBinaryPath(): string {
        return this.configService.get(
            'FILEMANAGER_BINARY',
            '/usr/local/emhttp/plugins/unraid-api/filebrowser/filebrowser'
        );
    }

    private getFileBrowserConfigPath(): string {
        return this.configService.get(
            'FILEMANAGER_CONFIG',
            '/boot/config/plugins/unraid-api/filebrowser/config.json'
        );
    }

    private getFileBrowserDatabasePath(): string {
        return this.configService.get(
            'FILEMANAGER_DATABASE',
            '/boot/config/plugins/unraid-api/filebrowser/database.db'
        );
    }
}
