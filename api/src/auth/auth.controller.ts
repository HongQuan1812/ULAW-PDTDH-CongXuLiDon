/* Nhóm API auth: phiên hiện tại, đăng nhập Google, đăng nhập thử (chỉ dev), đăng xuất. */
import { Body, Controller, Get, HttpCode, NotFoundException, Post, Query, Req, Res } from '@nestjs/common';
import { ApiFoundResponse, ApiOkResponse, ApiQuery, ApiTags } from '@nestjs/swagger';
import {
  AUTH_ENDPOINTS,
  AUTH_MESSAGES,
  DevLoginRequestSchema,
  GOOGLE_LOGIN_EMAIL_PARAM,
  GOOGLE_LOGIN_ERROR_PARAM,
  SessionSchema,
  isSchoolEmail,
  type DevLoginRequest,
  type GoogleLoginError,
  type Session,
} from '@ulaw/shared';
import type { Request, Response } from 'express';
import { ApiException } from '../common/api-exception';
import { openApiSchemaOf } from '../common/swagger';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { AppConfig } from '../config/app-config';
import type { User } from '../generated/prisma/client';
import { AuthService } from './auth.service';
import {
  GOOGLE_STATE_COOKIE_NAME,
  buildGoogleAuthorizeUrl,
  createGoogleLoginState,
  decodeGoogleLoginState,
  encodeGoogleLoginState,
  googleStateCookieOptions,
  toSafeReturnPath,
} from './google-oauth';
import { GoogleOAuthService } from './google-oauth.service';
import { CurrentUser, RequireLogin } from './require-permission.decorator';
import { SESSION_COOKIE_NAME, readCookie, readSessionToken, sessionCookieOptions } from './session-cookie';

/** Trang Đăng nhập của giao diện (hash router: #/dang-nhap), nơi báo lỗi đăng nhập Google. */
const WEB_LOGIN_HASH_PATH = '/dang-nhap';

@ApiTags('auth')
@Controller()
export class AuthController {
  /**
   * @param authService         tạo, tìm, xóa phiên; tìm / tạo tài khoản theo email Google
   * @param googleOAuthService  đổi code Google trả về lấy email, họ tên
   * @param appConfig           cấu hình (chế độ dev, OAuth client, địa chỉ giao diện)
   */
  constructor(
    private readonly authService: AuthService,
    private readonly googleOAuthService: GoogleOAuthService,
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

  /**
   * Bắt đầu đăng nhập Google: ghi state vào cookie rồi chuyển trình duyệt sang trang chọn tài khoản Google.
   * Trình duyệt mở thẳng đường này (không gọi bằng fetch).
   * @param from      trang trong giao diện cần mở sau khi đăng nhập, vd '/quan-li-don'; không hợp lệ thì về trang chính
   * @param response  response, để đặt cookie và chuyển trang
   */
  @Get(AUTH_ENDPOINTS.googleStart)
  @ApiQuery({ name: 'from', required: false, description: 'Trang cần mở sau khi đăng nhập, vd /quan-li-don' })
  @ApiFoundResponse({ description: 'Chuyển sang Google; chưa cấu hình OAuth client thì về trang Đăng nhập kèm loginError=notConfigured' })
  startGoogleLogin(@Query('from') from: unknown, @Res() response: Response): void {
    // Chưa có OAuth client: báo về trang Đăng nhập
    const google = this.appConfig.google;
    if (!google) return response.redirect(302, this.webLoginErrorUrl('notConfigured'));

    // Nhớ state, mã PKCE, trang cần mở; rồi sang Google
    const loginState = createGoogleLoginState(toSafeReturnPath(from));
    response.cookie(GOOGLE_STATE_COOKIE_NAME, encodeGoogleLoginState(loginState), googleStateCookieOptions(this.appConfig.isDev));
    response.redirect(302, buildGoogleAuthorizeUrl(google, loginState));
  }

  /**
   * Google chuyển về sau khi người dùng chọn tài khoản: kiểm tra state, đổi code lấy email, chỉ nhận email trường,
   * tìm hoặc tạo tài khoản, tạo phiên, rồi chuyển về giao diện. Lỗi thì về trang Đăng nhập kèm mã lỗi.
   * @param code      mã Google gửi kèm (không có khi người dùng bấm Hủy)
   * @param state     state Google trả lại, phải trùng state trong cookie
   * @param request   request, để đọc cookie state và phiên cũ
   * @param response  response, để đặt cookie phiên và chuyển trang
   */
  @Get(AUTH_ENDPOINTS.googleCallback)
  @ApiFoundResponse({ description: 'Đăng nhập xong thì về trang cần mở; lỗi thì về trang Đăng nhập kèm loginError' })
  async finishGoogleLogin(
    @Query('code') code: unknown,
    @Query('state') state: unknown,
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    // Cookie state chỉ dùng một lần
    const loginState = decodeGoogleLoginState(readCookie(request.headers.cookie, GOOGLE_STATE_COOKIE_NAME));
    const { maxAge: _stateMaxAge, ...clearStateOptions } = googleStateCookieOptions(this.appConfig.isDev);
    response.clearCookie(GOOGLE_STATE_COOKIE_NAME, clearStateOptions);

    // Chưa cấu hình; bấm Hủy, hết 10 phút, hoặc state không khớp (có thể là trang khác giả mạo)
    const google = this.appConfig.google;
    if (!google) return response.redirect(302, this.webLoginErrorUrl('notConfigured'));
    if (!loginState || typeof code !== 'string' || !code || state !== loginState.state) {
      return response.redirect(302, this.webLoginErrorUrl('failed'));
    }

    // Đổi code lấy email, họ tên
    const identity = await this.googleOAuthService.exchangeCode(google, code, loginState.codeVerifier);
    if (!identity) return response.redirect(302, this.webLoginErrorUrl('failed'));

    // Chỉ email trường được vào (SCHOOL_EMAIL_DOMAINS, kể cả tên miền con)
    if (!isSchoolEmail(identity.email)) return response.redirect(302, this.webLoginErrorUrl('notSchoolEmail', identity.email));

    // Tìm hoặc tạo tài khoản; xóa phiên cũ (nếu có), tạo phiên mới, đặt cookie
    const user = await this.authService.findOrCreateGoogleUser(identity.email, identity.name);
    const previousToken = readSessionToken(request.headers.cookie);
    if (previousToken) await this.authService.destroySession(previousToken);
    const token = await this.authService.createSession(user.id);
    response.cookie(SESSION_COOKIE_NAME, token, sessionCookieOptions(this.appConfig.isDev));

    // Về trang cần mở trong giao diện (hash router)
    response.redirect(302, this.webUrl(loginState.returnPath));
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

  /**
   * Địa chỉ đầy đủ của một trang trong giao diện (hash router).
   * @param hashPath  đường dẫn trong giao diện, vd '/quan-li-don' hoặc '/dang-nhap?loginError=failed'
   * @returns         vd 'https://localhost:5173/#/quan-li-don'
   */
  private webUrl(hashPath: string): string {
    return new URL(`/#${hashPath}`, this.appConfig.webBaseUrl).toString();
  }

  /**
   * Địa chỉ trang Đăng nhập kèm mã lỗi đăng nhập Google, để giao diện hiện câu báo.
   * @param error  mã lỗi
   * @param email  email bị từ chối (chỉ khi notSchoolEmail)
   * @returns      vd 'https://localhost:5173/#/dang-nhap?loginError=notSchoolEmail&email=an%40gmail.com'
   */
  private webLoginErrorUrl(error: GoogleLoginError, email?: string): string {
    const params = new URLSearchParams({ [GOOGLE_LOGIN_ERROR_PARAM]: error });
    if (email) params.set(GOOGLE_LOGIN_EMAIL_PARAM, email);
    return this.webUrl(`${WEB_LOGIN_HASH_PATH}?${params.toString()}`);
  }
}
