/* Nhóm API Nguồn dữ liệu: cấu hình (không có mật khẩu) và tình trạng kết nối tới database trường. Cần quyền manageDataSources. */
import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { DATA_SOURCE_ENDPOINTS, DATA_SOURCE_MESSAGES, DataSourcesResponseSchema, type DataSourcesResponse } from '@ulaw/shared';
import { RequirePermission } from '../auth/require-permission.decorator';
import { openApiSchemaOf } from '../common/swagger';
import { toVietnamTime } from '../common/vietnam-time';
import { AppConfig } from '../config/app-config';
import { SchoolDatabaseService } from '../student-directory/school-database.service';
import { SCHOOL_DATABASE_NAME } from '../student-directory/school-students-query';

@ApiTags('data-sources')
@Controller()
@RequirePermission('manageDataSources', DATA_SOURCE_MESSAGES[403])
export class DataSourcesController {
  /**
   * @param appConfig       cấu hình đang dùng (địa chỉ, tài khoản database trường; bản giả hay thật)
   * @param schoolDatabase  thử kết nối database trường
   */
  constructor(
    private readonly appConfig: AppConfig,
    private readonly schoolDatabase: SchoolDatabaseService,
  ) {}

  /**
   * Các nguồn dữ liệu và tình trạng kết nối, thử ngay lúc gọi.
   * @returns  database trường: cấu hình (không có mật khẩu), đã kết nối chưa, mất bao lâu, vì sao chưa kết nối
   */
  @Get(DATA_SOURCE_ENDPOINTS.list)
  @ApiOkResponse({ schema: openApiSchemaOf(DataSourcesResponseSchema) })
  async list(): Promise<DataSourcesResponse> {
    const config = this.appConfig.schoolDatabase;
    const check = await this.schoolDatabase.checkConnection();
    return {
      schoolDatabase: {
        host: config?.host ?? null,
        port: config?.port ?? 1433,
        database: SCHOOL_DATABASE_NAME,
        user: config?.user || null,
        ...check,
        usesSampleData: this.appConfig.usesDemoApi('dev-student-directory'),
        checkedAt: toVietnamTime(new Date()),
      },
    };
  }
}
