#!/usr/bin/env zx
import { mkdir, writeFile } from 'fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { $ } from 'zx';

/**
 * Downloads and sets up FileBrowser binary for the Unraid API
 */
const downloadFileBrowser = async () => {
    // Discover latest release info
    const arch = process.arch;
    const platform = process.platform;
    const releasesApi = 'https://api.github.com/repos/filebrowser/filebrowser/releases/latest';
    console.log('Resolving latest FileBrowser release via GitHub API...');
    const resp = await fetch(releasesApi);
    if (!resp.ok) throw new Error(`Failed to fetch release metadata: ${resp.status}`);
    const releaseJson: any = await resp.json();
    const tag = releaseJson.tag_name; // e.g. v2.43.0
    const version = tag.startsWith('v') ? tag.slice(1) : tag;

    const wantedPrefix = (() => {
        if (platform === 'linux') {
            if (arch === 'x64') return 'linux-amd64-filebrowser.tar.gz';
            if (arch === 'arm64') return 'linux-arm64-filebrowser.tar.gz';
            if (arch === 'arm') return 'linux-armv7-filebrowser.tar.gz';
        } else if (platform === 'darwin') {
            if (arch === 'x64') return 'darwin-amd64-filebrowser.tar.gz';
            if (arch === 'arm64') return 'darwin-arm64-filebrowser.tar.gz';
        }
        throw new Error(`Unsupported platform/arch: ${platform}/${arch}`);
    })();

    const asset = releaseJson.assets.find((a: any) => a.browser_download_url.endsWith(wantedPrefix));
    if (!asset) throw new Error(`Could not find matching asset for ${wantedPrefix}`);
    const downloadUrl = asset.browser_download_url;
    console.log(`Latest version resolved: ${version}; downloading asset ${wantedPrefix}`);
    const tempDir = './deploy/temp';
    const binaryDir = './deploy/release/bin';

    try {
        console.log(`Downloading FileBrowser from ${downloadUrl}...`);

        // Create directories
        await mkdir(tempDir, { recursive: true });
        await mkdir(binaryDir, { recursive: true });

        const finalBinaryPath = resolve(binaryDir, 'filebrowser');
        if (existsSync(finalBinaryPath)) {
            console.log('FileBrowser binary already exists, skipping download');
            return;
        }

        // Download the tarball
        await $`curl -L -o ${tempDir}/filebrowser.tar.gz ${downloadUrl}`;

        // Extract the tarball in place
        await $`tar -xzf ${tempDir}/filebrowser.tar.gz -C ${tempDir}`;

        // Move binary to final location
        await $`mv ${join(tempDir, 'filebrowser')} ${finalBinaryPath}`;

        // Make binary executable
        await $`chmod +x ${finalBinaryPath}`;

        console.log('FileBrowser binary downloaded and installed successfully');

        // Clean up archive
        await $`rm -f ${tempDir}/filebrowser.tar.gz`;
    } catch (error) {
        console.error('Failed to download FileBrowser:', error);
        throw error;
    }
};

/**
 * Creates a FileBrowser configuration file
 */
const createFileBrowserConfig = async () => {
    const configDir = './deploy/release/config/filebrowser';
    const configPath = join(configDir, 'config.json');

    await mkdir(configDir, { recursive: true });

    const config = {
        port: 8080,
        baseURL: '',
        address: '127.0.0.1',
        log: 'stdout',
        database: '/boot/config/plugins/unraid-api/filebrowser/database.db',
        root: '/mnt/user',
        noAuth: true, // Disable built-in auth, use proxy auth
        staticgen: '',
        cacheDir: '',
        plugin: '',
        allowCommands: false,
        allowEdit: true,
        allowNew: true,
        commands: [],
        rules: [],
    };

    await writeFile(configPath, JSON.stringify(config, null, 2));
    console.log('FileBrowser configuration created');
};

/**
 * Main setup function
 */
const setupFileBrowser = async () => {
    try {
        console.log('Setting up FileBrowser for Unraid API...');

        await downloadFileBrowser();
        await createFileBrowserConfig();

        console.log('FileBrowser setup completed successfully');
    } catch (error) {
        console.error('FileBrowser setup failed:', error);
        process.exit(1);
    }
};

// Run the setup
await setupFileBrowser();
