/* Nhóm API auth: phiên hiện tại, đăng nhập (Google; bản giả: đăng nhập thử), đăng xuất. */
import { Body, Controller, Get, HttpCode, Post, Query, Req, Res } from '@nestjs/common';
import { ApiFoundResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  AUTH_ENDPOINTS,
  AUTH_MESSAGES,
  LoginRequestSchema,
  LoginResponseSchema,
  GOOGLE_LOGIN_EMAIL_PARAM,
  GOOGLE_LOGIN_ERROR_PARAM,
  SessionSchema,
  isSchoolEmail,
  type LoginRequest,
  type LoginResponse,
  type RoleId,
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
/* JUST FOR DEMO: START · POST /auth/login dùng bản giả mà không gửi vai trò thì đăng nhập thử vai trò này */
const DEFAULT_DEMO_ROLE: RoleId = 'nguoiNopDon';
/* JUST FOR DEMO: END */

@ApiTags('auth')
@Controller()
export class AuthController {
  /**
   * @param authService         tạo, tìm, xóa phiên; tìm / tạo tài khoản theo email Google
   * @param googleOAuthService  đổi code Google trả về lấy email
   * @param appConfig           cấu hình (chế độ dev, API bản giả / thật, OAuth client, địa chỉ giao diện)
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
   * Nút "Đăng nhập bằng email trường". Máy chủ quyết định đăng nhập cách nào:
   * bản giả dev-login (ENABLE_DEMO_APIS=true, không nằm trong ALWAYS_REAL_APIS) thì đăng nhập thử luôn vào tài khoản mẫu
   * của vai trò được gửi; bản thật thì ghi state vào cookie và trả đường dẫn sang trang chọn tài khoản Google.
   * @param loginRequest  trang cần mở sau khi đăng nhập; vai trò, email thử (chỉ dùng ở bản giả)
   * @param request       request, để biết phiên cũ (đăng nhập thử)
   * @param response      response, để đặt cookie
   * @returns             { kind: 'session' } đã đăng nhập · { kind: 'redirect', url } sang Google
   * @throws              422 body sai · 503 chưa cấu hình OAuth client · (đăng nhập thử) 404 hết tài khoản vai trò đó, 403 email ngoài trường
   */
  @Post(AUTH_ENDPOINTS.login)
  @HttpCode(200)
  @ApiOkResponse({ schema: openApiSchemaOf(LoginResponseSchema) })
  async login(
    @Body(new ZodValidationPipe(LoginRequestSchema, AUTH_MESSAGES[422])) loginRequest: LoginRequest,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<LoginResponse> {
    /* JUST FOR DEMO: START · bản giả: đăng nhập thử, không qua Google. Bản thật: luôn sang Google */
    if (this.appConfig.usesDemoApi('dev-login')) {
      const session = await this.logInDemoAccount(loginRequest.role ?? DEFAULT_DEMO_ROLE, loginRequest.email, request, response);
      return { kind: 'session', session };
    }
    /* JUST FOR DEMO: END */

    // Chưa có OAuth client
    const google = this.appConfig.google;
    if (!google) throw new ApiException(503, AUTH_MESSAGES.googleNotConfigured);

    // Nhớ state, mã PKCE, trang cần mở; trả đường dẫn sang Google
    const loginState = createGoogleLoginState(toSafeReturnPath(loginRequest.from));
    response.cookie(GOOGLE_STATE_COOKIE_NAME, encodeGoogleLoginState(loginState), googleStateCookieOptions(this.appConfig.isDev));
    return { kind: 'redirect', url: buildGoogleAuthorizeUrl(google, loginState) };
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

    // Đổi code lấy email
    const identity = await this.googleOAuthService.exchangeCode(google, code, loginState.codeVerifier);
    if (!identity) return response.redirect(302, this.webLoginErrorUrl('failed'));

    // Chỉ email trường được vào (SCHOOL_EMAIL_DOMAINS, kể cả tên miền con)
    if (!isSchoolEmail(identity.email)) return response.redirect(302, this.webLoginErrorUrl('notSchoolEmail', identity.email));

    // Tìm hoặc tạo tài khoản; xóa phiên cũ (nếu có), tạo phiên mới, đặt cookie
    const user = await this.authService.findOrCreateGoogleUser(identity.email);
    const previousToken = readSessionToken(request.headers.cookie);
    if (previousToken) await this.authService.destroySession(previousToken);
    const token = await this.authService.createSession(user.id);
    response.cookie(SESSION_COOKIE_NAME, token, sessionCookieOptions(this.appConfig.isDev));

    // Về trang cần mở trong giao diện (hash router)
    response.redirect(302, this.webUrl(loginState.returnPath));
  }

  /* JUST FOR DEMO: START · bản giả dev-login của đăng nhập (chỉ dùng khi usesDemoApi('dev-login')); bản thật là Google OAuth */
  /**
   * Đăng nhập thử vào tài khoản mẫu của một vai trò: tạo phiên, đặt cookie.
   * @param role      vai trò
   * @param email     email giả làm email Google (không bắt buộc); bỏ trống = email của tài khoản mẫu
   * @param request   request, để xóa phiên cũ (nếu có)
   * @param response  response, để đặt cookie
   * @returns         Session của tài khoản mẫu
   * @throws          404 hết tài khoản vai trò đó · 403 email ngoài trường
   */
  private async logInDemoAccount(role: RoleId, email: string | undefined, request: Request, response: Response): Promise<Session> {
    // Tài khoản của vai trò này (Admin có thể đã đổi hết sang vai trò khác)
    const user = await this.authService.findDemoUser(role);
    if (!user) throw new ApiException(404, AUTH_MESSAGES.noDemoAccount);

    // Chỉ email trường được vào; có email thử thì kiểm tra email đó
    const loginEmail = email ?? user.email;
    if (!isSchoolEmail(loginEmail)) throw new ApiException(403, AUTH_MESSAGES[403](loginEmail));

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
