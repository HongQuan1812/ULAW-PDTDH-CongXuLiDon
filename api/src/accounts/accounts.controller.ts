/* Nhóm API accounts: Quản lí tài khoản (danh sách, CCCD đầy đủ, tạo, sửa). Cần quyền manageAccounts;
   riêng sửa thì quyền editApplicant cũng được, nhưng không được đổi vai trò. */
import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  ACCOUNT_ENDPOINTS,
  ACCOUNT_LIST_FIELDS,
  ACCOUNT_MESSAGES,
  AccountCccdsResponseSchema,
  AccountSchema,
  AccountsResponseSchema,
  COMMON_MESSAGES,
  CreateAccountRequestSchema,
  UpdateAccountRequestSchema,
  can,
  parseListQuery,
  parseUserIdsParam,
  type Account,
  type AccountCccdsResponse,
  type AccountsResponse,
  type CreateAccountRequest,
} from '@ulaw/shared';
import { CurrentUser, RequireLogin, RequirePermission } from '../auth/require-permission.decorator';
import { ApiException } from '../common/api-exception';
import { openApiSchemaOf } from '../common/swagger';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import type { User } from '../generated/prisma/client';
import { AccountsService } from './accounts.service';

@ApiTags('accounts')
@Controller()
export class AccountsController {
  /** @param accountsService  đọc, ghi tài khoản trong database */
  constructor(private readonly accountsService: AccountsService) {}

  /**
   * @returns  một trang tài khoản, CCCD che nhưng tìm được theo số đầy đủ
   * @throws   422 tham số trang sai
   */
  @Get(ACCOUNT_ENDPOINTS.list)
  @RequirePermission('manageAccounts', ACCOUNT_MESSAGES[403])
  @ApiOkResponse({ schema: openApiSchemaOf(AccountsResponseSchema) })
  list(@Query() queryParams: Record<string, string | undefined>): Promise<AccountsResponse> {
    const listQuery = parseListQuery(queryParams, ACCOUNT_LIST_FIELDS);
    if (!listQuery) throw new ApiException(422, COMMON_MESSAGES.listQuery);
    return this.accountsService.findPage(listQuery);
  }

  /**
   * Đặt trước /accounts/:userId để 'cccds' không bị hiểu là id.
   * @returns  CCCD đầy đủ của các tài khoản đang có trên trang bảng
   * @throws   422 danh sách userIds sai
   */
  @Get(ACCOUNT_ENDPOINTS.cccds)
  @RequirePermission('manageAccounts', ACCOUNT_MESSAGES[403])
  @ApiOkResponse({ schema: openApiSchemaOf(AccountCccdsResponseSchema) })
  cccds(@Query('userIds') userIdsParam: string | undefined): Promise<AccountCccdsResponse> {
    const userIds = parseUserIdsParam(userIdsParam);
    if (!userIds) throw new ApiException(422, COMMON_MESSAGES.userIds);
    return this.accountsService.findCccds(userIds);
  }

  /**
   * Tạo tài khoản mới.
   * @returns  tài khoản vừa tạo (201)
   * @throws   422 body sai · 409 email hoặc CCCD đã có tài khoản
   */
  @Post(ACCOUNT_ENDPOINTS.list)
  @RequirePermission('manageAccounts', ACCOUNT_MESSAGES[403])
  @ApiCreatedResponse({ schema: openApiSchemaOf(AccountSchema) })
  create(@Body(new ZodValidationPipe(CreateAccountRequestSchema, ACCOUNT_MESSAGES[422])) accountInput: CreateAccountRequest): Promise<Account> {
    return this.accountsService.create(accountInput);
  }

  /**
   * Sửa họ tên, CCCD, SĐT, vai trò. Body đọc trong hàm (không dùng pipe) để thiếu quyền (403) được báo trước body sai (422).
   * @param editor       người đang sửa
   * @param userId       id tài khoản cần sửa
   * @param requestBody  body chưa kiểm tra
   * @returns            tài khoản sau khi sửa
   * @throws             403 không có manageAccounts hoặc editApplicant, hoặc chỉ có editApplicant mà đổi vai trò ·
   *                     422 body sai, hoặc tự đổi vai trò · 404 không có tài khoản · 409 CCCD đã thuộc tài khoản khác
   */
  @Put(ACCOUNT_ENDPOINTS.account)
  @RequireLogin()
  @ApiOkResponse({ schema: openApiSchemaOf(AccountSchema) })
  async update(@CurrentUser() editor: User, @Param('userId') userId: string, @Body() requestBody: unknown): Promise<Account> {
    // Cần manageAccounts hoặc editApplicant
    if (!can(editor.role, 'manageAccounts') && !can(editor.role, 'editApplicant')) throw new ApiException(403, ACCOUNT_MESSAGES[403]);

    // Body sai thì 422, kèm câu báo lỗi của ô đầu tiên bị sai
    const parsed = UpdateAccountRequestSchema.safeParse(requestBody);
    if (!parsed.success) throw new ApiException(422, parsed.error.issues[0]?.message ?? ACCOUNT_MESSAGES[422]);

    // Chỉ có editApplicant mà đổi vai trò thì 403
    const current = await this.accountsService.findUser(userId);
    if (current && parsed.data.role !== current.role && !can(editor.role, 'manageAccounts')) {
      throw new ApiException(403, ACCOUNT_MESSAGES.roleForbidden);
    }

    return this.accountsService.update(userId, parsed.data, editor);
  }
}
