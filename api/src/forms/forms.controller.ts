/* Nhóm API forms: các bảng danh sách đơn, thống kê, CCCD người nộp. Lưu ý: các đường dẫn tĩnh ở đây (/forms/mine…)
   phải được đăng ký trước route /forms/:code của nhóm form (nộp, chi tiết đơn) để không bị hiểu nhầm là mã đơn. */
import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  COMMON_MESSAGES,
  FORMS_ENDPOINTS,
  FORMS_MESSAGES,
  FORM_LIST_FIELDS,
  FormCccdsResponseSchema,
  FormStatsSchema,
  HANDLED_FORM_LIST_FIELDS,
  HandledFormsResponseSchema,
  MANAGED_FORM_LIST_FIELDS,
  ManagedFormsResponseSchema,
  MyFormsResponseSchema,
  can,
  parseListQuery,
  parseUserIdsParam,
  type FormCccdsResponse,
  type FormStats,
  type HandledFormsResponse,
  type ListQuery,
  type ManagedFormsResponse,
  type MyFormsResponse,
  type TableField,
} from '@ulaw/shared';
import { CurrentUser, RequirePermission, RequireLogin } from '../auth/require-permission.decorator';
import { ApiException } from '../common/api-exception';
import { openApiSchemaOf } from '../common/swagger';
import type { User } from '../generated/prisma/client';
import { FormsService } from './forms.service';

/**
 * Đọc tham số trang, tìm, sắp xếp, lọc từ đường dẫn.
 * @param queryParams  tham số trên đường dẫn
 * @param fields       các cột của bảng
 * @returns            ListQuery
 * @throws             422 khi tham số sai
 */
function readListQueryOrFail<Row>(queryParams: Record<string, string | undefined>, fields: readonly TableField<Row>[]): ListQuery {
  const listQuery = parseListQuery(queryParams, fields);
  if (!listQuery) throw new ApiException(422, COMMON_MESSAGES.listQuery);
  return listQuery;
}

@ApiTags('forms')
@Controller()
export class FormsController {
  /** @param formsService  đọc các bảng đơn trong database */
  constructor(private readonly formsService: FormsService) {}

  /**
   * @returns  một trang trong các đơn mình đã nộp
   * @throws   422 tham số trang sai
   */
  @Get(FORMS_ENDPOINTS.mine)
  @RequireLogin()
  @ApiOkResponse({ schema: openApiSchemaOf(MyFormsResponseSchema) })
  mine(@CurrentUser() viewer: User, @Query() queryParams: Record<string, string | undefined>): Promise<MyFormsResponse> {
    return this.formsService.findFormsOf(viewer.id, readListQueryOrFail(queryParams, FORM_LIST_FIELDS));
  }

  /**
   * @returns  một trang trong các đơn mình là người tiếp nhận hoặc người xử lí
   * @throws   403 không có quyền decide · 422 tham số trang sai
   */
  @Get(FORMS_ENDPOINTS.handled)
  @RequirePermission('decide', FORMS_MESSAGES.handledForbidden)
  @ApiOkResponse({ schema: openApiSchemaOf(HandledFormsResponseSchema) })
  handled(@CurrentUser() viewer: User, @Query() queryParams: Record<string, string | undefined>): Promise<HandledFormsResponse> {
    return this.formsService.findFormsHandledBy(viewer.id, readListQueryOrFail(queryParams, HANDLED_FORM_LIST_FIELDS));
  }

  /**
   * @returns  một trang trong mọi đơn (CCCD che, người có quyền viewApplicant tìm được theo số đầy đủ)
   * @throws   403 không có quyền viewAll · 422 tham số trang sai
   */
  @Get(FORMS_ENDPOINTS.list)
  @RequirePermission('viewAll', FORMS_MESSAGES.listForbidden)
  @ApiOkResponse({ schema: openApiSchemaOf(ManagedFormsResponseSchema) })
  list(@CurrentUser() viewer: User, @Query() queryParams: Record<string, string | undefined>): Promise<ManagedFormsResponse> {
    return this.formsService.findManaged(readListQueryOrFail(queryParams, MANAGED_FORM_LIST_FIELDS), can(viewer.role, 'viewApplicant'));
  }

  /**
   * @returns  số đơn theo trạng thái và theo loại đơn
   * @throws   403 không có quyền viewAll
   */
  @Get(FORMS_ENDPOINTS.stats)
  @RequirePermission('viewAll', FORMS_MESSAGES.statsForbidden)
  @ApiOkResponse({ schema: openApiSchemaOf(FormStatsSchema) })
  stats(): Promise<FormStats> {
    return this.formsService.getStats();
  }

  /**
   * @returns  CCCD đầy đủ của những người nộp đang có trên trang bảng
   * @throws   403 không có quyền viewApplicant · 422 danh sách userIds sai
   */
  @Get(FORMS_ENDPOINTS.cccds)
  @RequirePermission('viewApplicant', FORMS_MESSAGES.cccdsForbidden)
  @ApiOkResponse({ schema: openApiSchemaOf(FormCccdsResponseSchema) })
  cccds(@Query('userIds') userIdsParam: string | undefined): Promise<FormCccdsResponse> {
    const userIds = parseUserIdsParam(userIdsParam);
    if (!userIds) throw new ApiException(422, COMMON_MESSAGES.userIds);
    return this.formsService.findCccds(userIds);
  }
}
