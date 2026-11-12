/* Nhóm API profile: hồ sơ của mình, hồ sơ người khác (chỉ xem), thông tin sinh viên, CCCD đầy đủ, đơn của một người. */
import { Body, Controller, Get, Param, Put, Query } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  COMMON_MESSAGES,
  FullCccdResponseSchema,
  HandledFormsResponseSchema,
  MAIN_STUDENT_MESSAGES,
  MyFormsResponseSchema,
  PROFILE_ENDPOINTS,
  PROFILE_MESSAGES,
  ProfileSchema,
  SessionSchema,
  SetMainStudentRequestSchema,
  StudentsResponseSchema,
  UpdateProfileRequestSchema,
  can,
  parseListQuery,
  FORM_LIST_FIELDS,
  HANDLED_FORM_LIST_FIELDS,
  type FullCccdResponse,
  type HandledFormsResponse,
  type ListQuery,
  type MyFormsResponse,
  type Profile,
  type Session,
  type SetMainStudentRequest,
  type StudentsResponse,
  type TableField,
  type UpdateProfileRequest,
} from '@ulaw/shared';
import { RequireLogin, RequirePermission, CurrentUser } from '../auth/require-permission.decorator';
import { ApiException } from '../common/api-exception';
import { openApiSchemaOf } from '../common/swagger';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import type { User } from '../generated/prisma/client';
import { FormsService } from '../forms/forms.service';
import { ProfileService } from './profile.service';

@ApiTags('profile')
@Controller()
export class ProfileController {
  /**
   * @param profileService  đọc, lưu hồ sơ trong database
   * @param formsService    danh sách đơn của một người
   */
  constructor(
    private readonly profileService: ProfileService,
    private readonly formsService: FormsService,
  ) {}

  /**
   * Tìm người dùng được xem hồ sơ.
   * @param userId  id từ đường dẫn
   * @returns       người dùng
   * @throws        404 nếu không có người này
   */
  private async findPersonOrFail(userId: string): Promise<User> {
    const person = await this.profileService.findUser(userId);
    if (!person) throw new ApiException(404, PROFILE_MESSAGES[404]);
    return person;
  }

  /**
   * Đọc lần hỏi một trang từ tham số trên đường dẫn.
   * @param queryParams  tham số trên đường dẫn
   * @param fields       các cột của bảng
   * @returns            lần hỏi trang
   * @throws             422 nếu tham số sai
   */
  private readListQueryOrFail(queryParams: Record<string, string | undefined>, fields: readonly TableField<never>[]): ListQuery {
    const listQuery = parseListQuery(queryParams, fields);
    if (!listQuery) throw new ApiException(422, COMMON_MESSAGES.listQuery);
    return listQuery;
  }

  /* ---------- Hồ sơ của mình ---------- */

  /** @returns hồ sơ của mình, CCCD che */
  @Get(PROFILE_ENDPOINTS.me)
  @RequireLogin()
  @ApiOkResponse({ schema: openApiSchemaOf(ProfileSchema) })
  me(@CurrentUser() user: User): Profile {
    return this.profileService.toProfile(user);
  }

  /** @returns số CCCD đầy đủ của mình (người dùng bấm "Hiện") */
  @Get(PROFILE_ENDPOINTS.myCccd)
  @RequireLogin()
  @ApiOkResponse({ schema: openApiSchemaOf(FullCccdResponseSchema) })
  myCccd(@CurrentUser() user: User): FullCccdResponse {
    return this.profileService.toFullCccd(user);
  }

  /** @returns các MSSV của mình và MSSV chính */
  @Get(PROFILE_ENDPOINTS.myStudents)
  @RequireLogin()
  @ApiOkResponse({ schema: openApiSchemaOf(StudentsResponseSchema) })
  myStudents(@CurrentUser() user: User): Promise<StudentsResponse> {
    return this.profileService.findStudents(user);
  }

  /**
   * Chọn MSSV chính của mình.
   * @param user                  người đang đăng nhập
   * @param setMainStudentRequest MSSV muốn chọn
   * @returns                     thông tin sinh viên mới
   * @throws                      422 body sai hoặc MSSV không thuộc mình
   */
  @Put(PROFILE_ENDPOINTS.myMainStudent)
  @RequireLogin()
  @ApiOkResponse({ schema: openApiSchemaOf(StudentsResponseSchema) })
  async setMyMainStudent(
    @CurrentUser() user: User,
    @Body(new ZodValidationPipe(SetMainStudentRequestSchema, MAIN_STUDENT_MESSAGES[422])) setMainStudentRequest: SetMainStudentRequest,
  ): Promise<StudentsResponse> {
    if (!(await this.profileService.ownsStudent(user.id, setMainStudentRequest.studentId))) {
      throw new ApiException(422, MAIN_STUDENT_MESSAGES[422]);
    }
    return this.profileService.saveMainStudent(user, setMainStudentRequest.studentId);
  }

  /**
   * Lưu họ tên, CCCD, SĐT của mình.
   * @param user           người đang đăng nhập
   * @param profileInput   dữ liệu đã kiểm tra
   * @returns              phiên mới (đã bổ sung thông tin)
   * @throws               422 body sai · 409 CCCD đã thuộc tài khoản khác
   */
  @Put(PROFILE_ENDPOINTS.me)
  @RequireLogin()
  @ApiOkResponse({ schema: openApiSchemaOf(SessionSchema) })
  async updateMe(
    @CurrentUser() user: User,
    @Body(new ZodValidationPipe(UpdateProfileRequestSchema, PROFILE_MESSAGES[422])) profileInput: UpdateProfileRequest,
  ): Promise<Session> {
    if (profileInput.cccd && (await this.profileService.isCccdTaken(profileInput.cccd, user.id))) {
      throw new ApiException(409, PROFILE_MESSAGES[409]);
    }
    const session = await this.profileService.saveProfile(user.id, profileInput);
    if (!session) throw new ApiException(409, PROFILE_MESSAGES[409]);
    return session;
  }

  /* ---------- Hồ sơ người khác (đặt sau các đường dẫn /profile/me để 'me' không bị hiểu là id) ---------- */

  /** @returns hồ sơ của người khác, CCCD che · 403 thiếu quyền viewApplicant · 404 không có người này */
  @Get(PROFILE_ENDPOINTS.person)
  @RequirePermission('viewApplicant', PROFILE_MESSAGES[403])
  @ApiOkResponse({ schema: openApiSchemaOf(ProfileSchema) })
  async person(@Param('userId') userId: string): Promise<Profile> {
    return this.profileService.toProfile(await this.findPersonOrFail(userId));
  }

  /** @returns số CCCD đầy đủ của người khác (người xem bấm "Hiện") */
  @Get(PROFILE_ENDPOINTS.personCccd)
  @RequirePermission('viewApplicant', PROFILE_MESSAGES[403])
  @ApiOkResponse({ schema: openApiSchemaOf(FullCccdResponseSchema) })
  async personCccd(@Param('userId') userId: string): Promise<FullCccdResponse> {
    return this.profileService.toFullCccd(await this.findPersonOrFail(userId));
  }

  /** @returns các MSSV của người khác và MSSV chính */
  @Get(PROFILE_ENDPOINTS.personStudents)
  @RequirePermission('viewApplicant', PROFILE_MESSAGES[403])
  @ApiOkResponse({ schema: openApiSchemaOf(StudentsResponseSchema) })
  async personStudents(@Param('userId') userId: string): Promise<StudentsResponse> {
    return this.profileService.findStudents(await this.findPersonOrFail(userId));
  }

  /** @returns một trang trong các đơn người đó đã nộp · 422 tham số trang sai */
  @Get(PROFILE_ENDPOINTS.personForms)
  @RequirePermission('viewApplicant', PROFILE_MESSAGES[403])
  @ApiOkResponse({ schema: openApiSchemaOf(MyFormsResponseSchema) })
  async personForms(@Param('userId') userId: string, @Query() queryParams: Record<string, string | undefined>): Promise<MyFormsResponse> {
    const person = await this.findPersonOrFail(userId);
    return this.formsService.findFormsOf(person.id, this.readListQueryOrFail(queryParams, FORM_LIST_FIELDS));
  }

  /**
   * Một trang trong các đơn một cán bộ tiếp nhận hoặc đang xử lí. Ngoài quyền xem hồ sơ, cần thêm quyền viewAll.
   * @throws  403 thiếu viewAll · 404 không có người này · 422 tham số trang sai
   */
  @Get(PROFILE_ENDPOINTS.personHandledForms)
  @RequirePermission('viewApplicant', PROFILE_MESSAGES[403])
  @ApiOkResponse({ schema: openApiSchemaOf(HandledFormsResponseSchema) })
  async personHandledForms(
    @CurrentUser() viewer: User,
    @Param('userId') userId: string,
    @Query() queryParams: Record<string, string | undefined>,
  ): Promise<HandledFormsResponse> {
    const person = await this.findPersonOrFail(userId);
    if (!can(viewer.role, 'viewAll')) throw new ApiException(403, PROFILE_MESSAGES.handledFormsForbidden);
    return this.formsService.findFormsHandledBy(person.id, this.readListQueryOrFail(queryParams, HANDLED_FORM_LIST_FIELDS));
  }

  /**
   * Chọn MSSV chính cho người khác. Ngoài quyền xem hồ sơ, cần thêm quyền editApplicant.
   * @throws  403 thiếu editApplicant · 404 không có người này · 422 body sai hoặc MSSV không thuộc người đó
   */
  @Put(PROFILE_ENDPOINTS.personMainStudent)
  @RequirePermission('viewApplicant', PROFILE_MESSAGES[403])
  @ApiOkResponse({ schema: openApiSchemaOf(StudentsResponseSchema) })
  async setPersonMainStudent(
    @CurrentUser() editor: User,
    @Param('userId') userId: string,
    @Body(new ZodValidationPipe(SetMainStudentRequestSchema, MAIN_STUDENT_MESSAGES[422])) setMainStudentRequest: SetMainStudentRequest,
  ): Promise<StudentsResponse> {
    const person = await this.findPersonOrFail(userId);
    if (!can(editor.role, 'editApplicant')) throw new ApiException(403, MAIN_STUDENT_MESSAGES[403]);
    if (!(await this.profileService.ownsStudent(person.id, setMainStudentRequest.studentId))) {
      throw new ApiException(422, MAIN_STUDENT_MESSAGES.personNotOwned);
    }
    return this.profileService.saveMainStudent(person, setMainStudentRequest.studentId);
  }
}
