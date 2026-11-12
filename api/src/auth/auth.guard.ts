/* Guard đăng nhập và quyền: đọc cookie phiên, tìm người dùng, kiểm tra quyền khai báo ở @RequirePermission. */
import { Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AUTH_MESSAGES, can } from '@ulaw/shared';
import type { Request } from 'express';
import { ApiException } from '../common/api-exception';
import { AuthService } from './auth.service';
import { REQUIRED_ACCESS_KEY, type RequiredAccess } from './require-permission.decorator';
import { readSessionToken } from './session-cookie';
import type { User } from '../generated/prisma/client';

/** Request sau khi qua guard: có người đang đăng nhập. */
export type AuthenticatedRequest = Request & { authUser: User };

@Injectable()
export class AuthGuard implements CanActivate {
  /**
   * @param authService  tìm người dùng theo mã phiên
   * @param reflector    đọc khai báo của @RequireLogin / @RequirePermission
   */
  constructor(
    private readonly authService: AuthService,
    private readonly reflector: Reflector,
  ) {}

  /**
   * Cho request đi tiếp hay không.
   * @param context  ngữ cảnh request
   * @returns        true khi đã đăng nhập và (nếu route đòi quyền) vai trò có quyền đó
   * @throws         ApiException 401 khi chưa đăng nhập · 403 khi thiếu quyền (câu báo do route khai báo)
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Tìm người đang đăng nhập; chưa đăng nhập thì 401
    const request = context.switchToHttp().getRequest<Request>();
    const token = readSessionToken(request.headers.cookie);
    const user = token ? await this.authService.findUserBySessionToken(token) : null;
    if (!user) throw new ApiException(401, AUTH_MESSAGES[401]);

    // Route đòi quyền thì kiểm tra theo vai trò hiện tại trong database
    const requiredAccess = this.reflector.getAllAndOverride<RequiredAccess | undefined>(REQUIRED_ACCESS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (requiredAccess?.permission && !can(user.role, requiredAccess.permission)) {
      throw new ApiException(403, requiredAccess.forbiddenMessage);
    }

    // Cho controller dùng
    (request as AuthenticatedRequest).authUser = user;
    return true;
  }
}
