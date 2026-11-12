/* Khai báo route cần đăng nhập, hoặc cần thêm một quyền (ROLES trong shared/). */
import { SetMetadata, UseGuards, applyDecorators, createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Permission } from '@ulaw/shared';
import type { User } from '../generated/prisma/client';
import { AuthGuard, type AuthenticatedRequest } from './auth.guard';

/** Khóa lưu khai báo quyền trên route. */
export const REQUIRED_ACCESS_KEY = 'requiredAccess';

/** Điều kiện của route: quyền cần có (không có = chỉ cần đăng nhập) và câu báo khi thiếu quyền (403). */
export interface RequiredAccess {
  permission?: Permission;
  forbiddenMessage: string;
}

/**
 * Route chỉ cần đăng nhập. Chưa đăng nhập thì 401.
 * @returns  decorator gắn vào route hoặc controller
 */
export function RequireLogin(): MethodDecorator & ClassDecorator {
  return applyDecorators(SetMetadata(REQUIRED_ACCESS_KEY, { forbiddenMessage: '' } satisfies RequiredAccess), UseGuards(AuthGuard));
}

/**
 * Route cần đăng nhập và vai trò có quyền này. Chưa đăng nhập thì 401, thiếu quyền thì 403.
 * @param permission        quyền cần có, vd 'manageAccounts'
 * @param forbiddenMessage  câu báo khi thiếu quyền, lấy từ hợp đồng của nhóm, vd ACCOUNT_MESSAGES[403]
 * @returns                 decorator gắn vào route hoặc controller
 */
export function RequirePermission(permission: Permission, forbiddenMessage: string): MethodDecorator & ClassDecorator {
  return applyDecorators(
    SetMetadata(REQUIRED_ACCESS_KEY, { permission, forbiddenMessage } satisfies RequiredAccess),
    UseGuards(AuthGuard),
  );
}

/** Lấy người đang đăng nhập (dòng User) trong controller; chỉ dùng ở route có @RequireLogin hoặc @RequirePermission. */
export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext): User =>
  context.switchToHttp().getRequest<AuthenticatedRequest>().authUser,
);
