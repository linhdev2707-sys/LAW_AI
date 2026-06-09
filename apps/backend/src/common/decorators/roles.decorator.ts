import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@law-ai/shared';

/** Metadata key consumed by `RolesGuard`. */
export const ROLES_KEY = 'roles';

/**
 * Mark a route handler (or controller) as requiring one of the listed roles.
 *
 * @example
 *   @Roles(UserRole.ADMIN)
 *   @UseGuards(JwtAuthGuard, RolesGuard)
 *   @Post('admin/rag/documents')
 *   create() { ... }
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
