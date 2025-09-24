import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';

import { AuthService } from '@app/unraid-api/auth/auth.service.js';
import { UnraidUser } from '@app/unraid-api/file-manager/auth/token-bridge.service.js';
import { UserAccount } from '@app/unraid-api/graph/user/user.model.js';

@Injectable()
export class UnraidAuthService {
    private readonly logger = new Logger(UnraidAuthService.name);

    constructor(private readonly authService: AuthService) {}

    /**
     * Authenticate user credentials against Unraid system
     * This method validates username/password against Unraid's user system
     */
    async authenticateUser(username: string, password: string): Promise<UnraidUser | null> {
        try {
            this.logger.debug(`Attempting to authenticate user: ${username}`);

            // TODO: Implement proper Unraid authentication
            // For now, we'll use a mock implementation
            // In production, this should validate against Unraid's user system

            // Mock validation - replace with actual Unraid authentication
            if (username && password) {
                // Create a mock user for development
                const mockUser: UnraidUser = {
                    id: `user-${username}`,
                    username: username,
                    roles: ['user'], // Default role
                    permissions: ['read', 'write'], // Default permissions
                };

                this.logger.log(`User ${username} authenticated successfully`);
                return mockUser;
            }

            return null;
        } catch (error) {
            this.logger.error(`Authentication failed for user ${username}:`, error);
            return null;
        }
    }

    /**
     * Validate session token and return user information
     * This method validates existing session tokens
     */
    async validateSession(sessionToken: string): Promise<UnraidUser | null> {
        try {
            this.logger.debug('Validating session token');

            // TODO: Implement proper session validation
            // For now, we'll use a mock implementation
            if (sessionToken === 'mock-session-token') {
                const mockUser: UnraidUser = {
                    id: 'user-admin',
                    username: 'admin',
                    roles: ['admin'],
                    permissions: ['read', 'write', 'delete', 'admin'],
                };

                this.logger.debug('Session token validated successfully');
                return mockUser;
            }

            return null;
        } catch (error) {
            this.logger.error('Session validation failed:', error);
            return null;
        }
    }

    /**
     * Check if user has permission to access file manager
     * This integrates with Unraid's permission system
     */
    async hasFileManagerAccess(user: UnraidUser): Promise<boolean> {
        try {
            // Check if user has required roles or permissions
            const requiredRoles = ['admin', 'user'];
            const requiredPermissions = ['read', 'write'];

            const hasRequiredRole = user.roles.some((role) => requiredRoles.includes(role));
            const hasRequiredPermission = user.permissions?.some((permission) =>
                requiredPermissions.includes(permission)
            );

            const hasAccess = hasRequiredRole || hasRequiredPermission;

            this.logger.debug(`File manager access check for user ${user.username}: ${hasAccess}`);
            return hasAccess;
        } catch (error) {
            this.logger.error('File manager access check failed:', error);
            return false;
        }
    }

    /**
     * Get user's file system permissions
     * This determines what directories the user can access
     */
    async getUserFilePermissions(user: UnraidUser): Promise<{
        allowedPaths: string[];
        readOnly: boolean;
    }> {
        try {
            // Default permissions based on user role
            let allowedPaths: string[] = [];
            let readOnly = false;

            if (user.roles.includes('admin')) {
                // Admin users can access all paths
                allowedPaths = ['/mnt/user', '/mnt/cache', '/mnt/disk*', '/boot'];
                readOnly = false;
            } else if (user.roles.includes('user')) {
                // Regular users have limited access
                allowedPaths = ['/mnt/user', '/mnt/cache'];
                readOnly = false;
            } else {
                // Read-only access for other roles
                allowedPaths = ['/mnt/user'];
                readOnly = true;
            }

            this.logger.debug(`File permissions for user ${user.username}:`, {
                allowedPaths,
                readOnly,
            });

            return { allowedPaths, readOnly };
        } catch (error) {
            this.logger.error('Failed to get user file permissions:', error);
            return { allowedPaths: [], readOnly: true };
        }
    }
}
