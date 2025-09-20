import { Injectable, Logger } from '@nestjs/common';

export interface UnraidUser {
    id: string;
    username: string;
    roles: string[];
    permissions?: string[];
}

@Injectable()
export class TokenBridgeService {
    private readonly logger = new Logger(TokenBridgeService.name);

    /**
     * Bridge Unraid authentication to FileBrowser authentication
     * This service handles the conversion between Unraid's auth system
     * and FileBrowser's expected authentication format
     */

    buildFileBrowserAuthHeaders(user: UnraidUser): Record<string, string> {
        const headers: Record<string, string> = {
            'X-Unraid-User': user.username,
            'X-Unraid-User-ID': user.id,
            'X-Unraid-Roles': user.roles.join(','),
            'X-Authenticated-User': user.username,
        };

        // Add permission-based headers
        const permissions = this.mapUserPermissions(user);
        if (permissions.length > 0) {
            headers['X-Unraid-Permissions'] = permissions.join(',');
        }

        return headers;
    }

    /**
     * Validate that the current user has permission to access FileBrowser
     * This integrates with Unraid's permission system
     */
    validateFileBrowserAccess(user: UnraidUser): boolean {
        // Check roles for file manager access
        const hasAccess =
            user.roles.includes('admin') ||
            user.roles.includes('share.read') ||
            user.roles.includes('share.write') ||
            user.roles.includes('filemanager.access');

        if (!hasAccess) {
            this.logger.warn(
                `User ${user.username} denied access to FileBrowser - roles: ${user.roles.join(', ')}`
            );
        }

        return hasAccess;
    }

    /**
     * Map Unraid user roles to FileBrowser permissions
     * This determines what operations the user can perform
     */
    mapUserPermissions(user: UnraidUser): string[] {
        const permissions: string[] = [];

        // Admin has full access
        if (user.roles.includes('admin')) {
            permissions.push('admin', 'read', 'write', 'delete', 'share', 'upload', 'download');
        } else {
            // Check specific permissions
            if (user.roles.includes('share.read')) {
                permissions.push('read', 'download');
            }

            if (user.roles.includes('share.write')) {
                permissions.push('write', 'upload', 'delete');
            }

            if (user.roles.includes('filemanager.share')) {
                permissions.push('share');
            }
        }

        return permissions;
    }

    /**
     * Extract user information from Unraid session
     * This integrates with the existing Unraid authentication system
     */
    extractUserFromSession(sessionData: any): UnraidUser | null {
        try {
            if (!sessionData) {
                return null;
            }

            // Extract user information based on Unraid's session structure
            const user: UnraidUser = {
                id: sessionData.id || sessionData.userId || 'unknown',
                username: sessionData.username || sessionData.name || 'anonymous',
                roles: Array.isArray(sessionData.roles) ? sessionData.roles : ['user'],
                permissions: Array.isArray(sessionData.permissions) ? sessionData.permissions : [],
            };

            return user;
        } catch (error) {
            this.logger.error('Failed to extract user from session', error);
            return null;
        }
    }

    /**
     * Check if user has specific permission for file operations
     */
    hasPermission(user: UnraidUser, permission: string): boolean {
        const userPermissions = this.mapUserPermissions(user);
        return userPermissions.includes(permission) || userPermissions.includes('admin');
    }
}
