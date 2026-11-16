/* API giả: Nguồn dữ liệu (cấu hình và tình trạng kết nối database trường). Chỉ vai trò có quyền manageDataSources. */
import { delay, http, HttpResponse } from 'msw';
import { DATA_SOURCE_MESSAGES, ENDPOINTS, can, type DataSourcesResponse } from '@ulaw/shared';
import { readSession, vietnamNow } from '../db';
import { MOCK_DELAY_MS, api, apiError } from '../http';

export const dataSourceHandlers = [
  // Tình trạng các nguồn dữ liệu
  http.get(api(ENDPOINTS.dataSources.list), async () => {
    await delay(MOCK_DELAY_MS);
    const session = await readSession();
    if (!session) return apiError(401, DATA_SOURCE_MESSAGES[401]);
    if (!can(session.role, 'manageDataSources')) return apiError(403, DATA_SOURCE_MESSAGES[403]);

    /* JUST FOR DEMO: START · API giả không kết nối database trường: coi như chưa cấu hình, trang hồ sơ dùng bảng mẫu.
       Máy chủ thật đọc cấu hình SCHOOL_DB_* và thử kết nối mỗi lần gọi. */
    return HttpResponse.json<DataSourcesResponse>({
      schoolDatabase: {
        host: null,
        port: 1433,
        database: 'CoreUis',
        user: null,
        connected: false,
        latencyMs: null,
        problem: 'notConfigured',
        usesSampleData: true,
        checkedAt: vietnamNow(),
      },
    });
    /* JUST FOR DEMO: END */
  }),
];
