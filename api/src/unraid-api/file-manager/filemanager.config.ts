export interface FileManagerConfig {
    service: 'filebrowser';
    port: number;
    binary: string;
    database: string;
    config: string;
    auth: {
        method: 'proxy';
        header: string;
    };
    roots: Array<{
        name: string;
        path: string;
        writable: boolean;
    }>;
}

export const defaultFileManagerConfig: FileManagerConfig = {
    service: 'filebrowser',
    port: 8080,
    binary: '/usr/local/emhttp/plugins/unraid-api/filebrowser/filebrowser',
    database: '/boot/config/plugins/unraid-api/filebrowser/database.db',
    config: '/boot/config/plugins/unraid-api/filebrowser/config.json',
    auth: {
        method: 'proxy',
        header: 'X-Unraid-User',
    },
    roots: [
        {
            name: 'User Shares',
            path: '/mnt/user',
            writable: true,
        },
        {
            name: 'Cache',
            path: '/mnt/cache',
            writable: true,
        },
        {
            name: 'Disks',
            path: '/mnt/disk*',
            writable: true,
        },
        {
            name: 'Boot',
            path: '/boot',
            writable: false,
        },
    ],
};
