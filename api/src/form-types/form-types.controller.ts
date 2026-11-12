/* Nhóm API form-types: loại đơn và các phiên bản. Xem loại đơn đang mở chỉ cần đăng nhập;
   mọi lệnh còn lại cần quyền manageFormTypes. */
import { Body, Controller, Delete, Get, Param, Post, Put, Res } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import {
  FORM_TYPE_ENDPOINTS,
  FORM_TYPE_MESSAGES,
  FormTypeSchema,
  FormTypesResponseSchema,
  ManagedFormTypeSchema,
  OpenFormTypesResponseSchema,
  SaveFormTypeVersionRequestSchema,
  SetFormTypeVersionStatusRequestSchema,
  type FormType,
  type FormTypesResponse,
  type ManagedFormType,
  type OpenFormTypesResponse,
  type SaveFormTypeVersionRequest,
} from '@ulaw/shared';
import { CurrentUser, RequireLogin, RequirePermission } from '../auth/require-permission.decorator';
import { ApiException } from '../common/api-exception';
import { openApiSchemaOf } from '../common/swagger';
import type { User } from '../generated/prisma/client';
import { FormTypesService } from './form-types.service';

/**
 * Đọc số phiên bản từ đường dẫn.
 * @param versionText  chữ trong đường dẫn, vd '2'
 * @returns            số phiên bản
 * @throws             404 không phải số nguyên dương (không có phiên bản như vậy)
 */
function parseVersion(versionText: string): number {
  const version = Number(versionText);
  if (!Number.isInteger(version) || version < 1) throw new ApiException(404, FORM_TYPE_MESSAGES.versionNotFound);
  return version;
}

/**
 * Kiểm tra bản soạn gửi lên đúng dạng (nội dung do validateFormTypeDraft kiểm tra tiếp ở service).
 * @param requestBody  body chưa kiểm tra
 * @returns            bản soạn
 * @throws             422 sai dạng
 */
function parseSaveRequest(requestBody: unknown): SaveFormTypeVersionRequest {
  const parsed = SaveFormTypeVersionRequestSchema.safeParse(requestBody);
  if (!parsed.success) throw new ApiException(422, FORM_TYPE_MESSAGES.invalidRequest);
  return parsed.data;
}

@ApiTags('form-types')
@Controller()
export class FormTypesController {
  /** @param formTypesService  đọc, ghi loại đơn trong database */
  constructor(private readonly formTypesService: FormTypesService) {}

  /** @returns  mọi loại đơn, mỗi loại một dòng theo phiên bản mới nhất */
  @Get(FORM_TYPE_ENDPOINTS.list)
  @RequirePermission('manageFormTypes', FORM_TYPE_MESSAGES[403])
  @ApiOkResponse({ schema: openApiSchemaOf(FormTypesResponseSchema) })
  list(): Promise<FormTypesResponse> {
    return this.formTypesService.findSummaries();
  }

  /**
   * Tạo loại đơn với phiên bản 1.
   * @returns  loại đơn vừa tạo (201)
   * @throws   422 sai dạng hoặc bản soạn chưa hợp lệ · 409 mã đơn đã có
   */
  @Post(FORM_TYPE_ENDPOINTS.create)
  @RequirePermission('manageFormTypes', FORM_TYPE_MESSAGES[403])
  @ApiCreatedResponse({ schema: openApiSchemaOf(ManagedFormTypeSchema) })
  create(@CurrentUser() staff: User, @Body() requestBody: unknown): Promise<ManagedFormType> {
    return this.formTypesService.create(parseSaveRequest(requestBody), staff.id);
  }

  /** Đặt trước /form-types/:formTypeId để 'open' không bị hiểu là mã loại đơn. @returns  các loại đơn đang nhận đơn */
  @Get(FORM_TYPE_ENDPOINTS.open)
  @RequireLogin()
  @ApiOkResponse({ schema: openApiSchemaOf(OpenFormTypesResponseSchema) })
  listOpen(): Promise<OpenFormTypesResponse> {
    return this.formTypesService.findOpen();
  }

  /**
   * @returns  phiên bản đang mở của loại đơn, đủ cấu trúc các phần, câu hỏi
   * @throws   404 không có loại đơn, hoặc không có phiên bản nào đang mở
   */
  @Get(FORM_TYPE_ENDPOINTS.detail)
  @RequireLogin()
  @ApiOkResponse({ schema: openApiSchemaOf(FormTypeSchema) })
  detail(@Param('formTypeId') formTypeId: string): Promise<FormType> {
    return this.formTypesService.findOpenDetail(formTypeId);
  }

  /**
   * @returns  loại đơn kèm mọi phiên bản
   * @throws   404 không có loại đơn
   */
  @Get(FORM_TYPE_ENDPOINTS.versions)
  @RequirePermission('manageFormTypes', FORM_TYPE_MESSAGES[403])
  @ApiOkResponse({ schema: openApiSchemaOf(ManagedFormTypeSchema) })
  findManaged(@Param('formTypeId') formTypeId: string): Promise<ManagedFormType> {
    return this.formTypesService.findManaged(formTypeId);
  }

  /**
   * Thêm phiên bản mới.
   * @returns  loại đơn sau khi thêm (201)
   * @throws   404 không có loại đơn · 409 đang có Nháp, mã đơn khóa hoặc trùng · 422 sai dạng hoặc chưa hợp lệ
   */
  @Post(FORM_TYPE_ENDPOINTS.versions)
  @RequirePermission('manageFormTypes', FORM_TYPE_MESSAGES[403])
  @ApiCreatedResponse({ schema: openApiSchemaOf(ManagedFormTypeSchema) })
  addVersion(@CurrentUser() staff: User, @Param('formTypeId') formTypeId: string, @Body() requestBody: unknown): Promise<ManagedFormType> {
    return this.formTypesService.addVersion(formTypeId, parseSaveRequest(requestBody), staff.id);
  }

  /**
   * Lưu phiên bản Nháp (hoặc mở luôn).
   * @returns  loại đơn sau khi lưu
   * @throws   404 không có loại đơn, phiên bản · 409 phiên bản đã khóa, mã đơn khóa hoặc trùng · 422 sai dạng hoặc chưa hợp lệ
   */
  @Put(FORM_TYPE_ENDPOINTS.version)
  @RequirePermission('manageFormTypes', FORM_TYPE_MESSAGES[403])
  @ApiOkResponse({ schema: openApiSchemaOf(ManagedFormTypeSchema) })
  saveVersion(
    @CurrentUser() staff: User,
    @Param('formTypeId') formTypeId: string,
    @Param('version') versionText: string,
    @Body() requestBody: unknown,
  ): Promise<ManagedFormType> {
    return this.formTypesService.saveVersion(formTypeId, parseVersion(versionText), parseSaveRequest(requestBody), staff.id);
  }

  /**
   * Xóa phiên bản Nháp.
   * @returns  loại đơn sau khi xóa; xóa luôn loại đơn (phiên bản duy nhất) thì 204, không có body
   * @throws   404 không có loại đơn, phiên bản · 409 phiên bản đã khóa
   */
  @Delete(FORM_TYPE_ENDPOINTS.version)
  @RequirePermission('manageFormTypes', FORM_TYPE_MESSAGES[403])
  @ApiOkResponse({ schema: openApiSchemaOf(ManagedFormTypeSchema) })
  async deleteVersion(
    @Param('formTypeId') formTypeId: string,
    @Param('version') versionText: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ManagedFormType | undefined> {
    const formType = await this.formTypesService.deleteVersion(formTypeId, parseVersion(versionText));
    if (!formType) response.status(204);
    return formType ?? undefined;
  }

  /**
   * Mở / đóng phiên bản đã khóa.
   * @returns  loại đơn sau khi đổi
   * @throws   404 không có loại đơn, phiên bản · 409 phiên bản còn là Nháp · 422 sai dạng
   */
  @Put(FORM_TYPE_ENDPOINTS.versionStatus)
  @RequirePermission('manageFormTypes', FORM_TYPE_MESSAGES[403])
  @ApiOkResponse({ schema: openApiSchemaOf(ManagedFormTypeSchema) })
  setVersionStatus(
    @CurrentUser() staff: User,
    @Param('formTypeId') formTypeId: string,
    @Param('version') versionText: string,
    @Body() requestBody: unknown,
  ): Promise<ManagedFormType> {
    const parsed = SetFormTypeVersionStatusRequestSchema.safeParse(requestBody);
    if (!parsed.success) throw new ApiException(422, FORM_TYPE_MESSAGES.invalidRequest);
    return this.formTypesService.setVersionStatus(formTypeId, parseVersion(versionText), parsed.data.status, staff.id);
  }
}
