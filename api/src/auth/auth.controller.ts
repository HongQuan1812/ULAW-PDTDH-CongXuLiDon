/* Nhóm API auth: phiên hiện tại, đăng nhập thử (chỉ dev), đăng xuất. */
import { Body, Controller, Get, HttpCode, NotFoundException, Post, Req, Res } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  AUTH_ENDPOINTS,
  AUTH_MESSAGES,
  DevLoginRequestSchema,
  SessionSchema,
  isSchoolEmail,
  type DevLoginRequest,
  type Session,
} from '@ulaw/shared';
import type { Request, Response } from 'express';
import { ApiException } from '../common/api-exception';
import { openApiSchemaOf } from '../common/swagger';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { AppConfig } from '../config/app-config';
import type { User } from '../generated/prisma/client';
import { AuthService } from './auth.service';
import { CurrentUser, RequireLogin } from './require-permission.decorator';
import { SESSION_COOKIE_NAME, readSessionToken, sessionCookieOptions } from './session-cookie';

@ApiTags('auth')
@Controller()
export class AuthController {
  /**
   * @param authService  tạo, tìm, xóa phiên
   * @param appConfig    cấu hình (đang ở chế độ dev hay không)
   */
  constructor(
    private readonly authService: AuthService,
    private readonly appConfig: AppConfig,
  ) {}

  /**
   * Phiên hiện tại.
   * @param user  người đang đăng nhập (guard đã kiểm tra cookie)
   * @returns     Session; chưa đăng nhập thì 401
   */
  @Get(AUTH_ENDPOINTS.me)
  @RequireLogin()
  @ApiOkResponse({ schema: openApiSchemaOf(SessionSchema) })
  me(@CurrentUser() user: User): Session {
    return this.authService.toSession(user);
  }

  /* JUST FOR DEMO: START · đăng nhập thử theo vai trò, chỉ bật khi APP_ENV=dev; bản thật dùng Google OAuth */
  /**
   * Đăng nhập thử: chọn vai trò, nhận cookie phiên.
   * @param devLoginRequest  vai trò, và email giả làm email Google (không bắt buộc)
   * @param request          request, để biết phiên cũ (đổi vai trò thì phiên cũ bị xóa)
   * @param response         response, để đặt cookie
   * @returns                Session của tài khoản được chọn
   * @throws                 404 khi không ở chế độ dev · 422 body sai · 404 hết tài khoản vai trò đó · 403 email ngoài trường
   */
  @Post(AUTH_ENDPOINTS.devLogin)
  @HttpCode(200)
  @ApiOkResponse({ schema: openApiSchemaOf(SessionSchema) })
  async devLogin(
    @Body(new ZodValidationPipe(DevLoginRequestSchema, AUTH_MESSAGES[422])) devLoginRequest: DevLoginRequest,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<Session> {
    // Bản thật không có đường này
    if (!this.appConfig.isDev) throw new NotFoundException();

    // Tài khoản của vai trò này (Admin có thể đã đổi hết sang vai trò khác)
    const user = await this.authService.findDemoUser(devLoginRequest.role);
    if (!user) throw new ApiException(404, AUTH_MESSAGES.noDemoAccount);

    // Chỉ email trường được vào; có email thử thì kiểm tra email đó
    const email = devLoginRequest.email ?? user.email;
    if (!isSchoolEmail(email)) throw new ApiException(403, AUTH_MESSAGES[403](email));

    // Xóa phiên cũ (nếu có), tạo phiên mới, đặt cookie
    const previousToken = readSessionToken(request.headers.cookie);
    if (previousToken) await this.authService.destroySession(previousToken);
    const token = await this.authService.createSession(user.id);
    response.cookie(SESSION_COOKIE_NAME, token, sessionCookieOptions(this.appConfig.isDev));
    return this.authService.toSession(user);
  }
  /* JUST FOR DEMO: END */

  /**
   * Đăng xuất: xóa phiên trong database và cookie. Chưa đăng nhập cũng trả 204.
   * @param request   request, để đọc cookie phiên
   * @param response  response, để xóa cookie
   */
  @Post(AUTH_ENDPOINTS.logout)
  @HttpCode(204)
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response): Promise<void> {
    const token = readSessionToken(request.headers.cookie);
    if (token) await this.authService.destroySession(token);
    const { maxAge: _maxAge, ...clearOptions } = sessionCookieOptions(this.appConfig.isDev);
    response.clearCookie(SESSION_COOKIE_NAME, clearOptions);
  }
}
