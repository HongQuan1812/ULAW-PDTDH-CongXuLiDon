/* Nhóm API holidays: ngày nghỉ (lễ, Tết, nghỉ bù) mà hạn xử lí đơn không tính. Mọi lệnh cần quyền manageHolidays. */
import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put } from '@nestjs/common';
import { ApiCreatedResponse, ApiNoContentResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  HOLIDAY_ENDPOINTS,
  HOLIDAY_MESSAGES,
  HolidayInputSchema,
  HolidaySchema,
  HolidaysResponseSchema,
  type Holiday,
  type HolidayInput,
  type HolidaysResponse,
} from '@ulaw/shared';
import { RequirePermission } from '../auth/require-permission.decorator';
import { ApiException } from '../common/api-exception';
import { openApiSchemaOf } from '../common/swagger';
import { HolidaysService } from './holidays.service';

/**
 * Kiểm tra body thêm / sửa ngày nghỉ, giống API giả.
 * @param requestBody  body chưa kiểm tra
 * @returns            body đã kiểm tra
 * @throws             422 kèm câu báo của ô sai đầu tiên
 */
function readHolidayBody(requestBody: unknown): HolidayInput {
  const parsed = HolidayInputSchema.safeParse(requestBody);
  if (parsed.success) return parsed.data;
  throw new ApiException(422, parsed.error.issues[0]?.message ?? HOLIDAY_MESSAGES[422]);
}

@ApiTags('holidays')
@Controller()
@RequirePermission('manageHolidays', HOLIDAY_MESSAGES[403])
export class HolidaysController {
  /** @param holidaysService  đọc, ghi ngày nghỉ */
  constructor(private readonly holidaysService: HolidaysService) {}

  /** @returns  mọi ngày nghỉ, sớm trước muộn sau */
  @Get(HOLIDAY_ENDPOINTS.list)
  @ApiOkResponse({ schema: openApiSchemaOf(HolidaysResponseSchema) })
  list(): Promise<HolidaysResponse> {
    return this.holidaysService.findAll();
  }

  /**
   * Thêm ngày nghỉ.
   * @returns  ngày nghỉ mới (201)
   * @throws   422 body sai · 409 trùng ngày với ngày nghỉ khác
   */
  @Post(HOLIDAY_ENDPOINTS.list)
  @ApiCreatedResponse({ schema: openApiSchemaOf(HolidaySchema) })
  create(@Body() requestBody: unknown): Promise<Holiday> {
    return this.holidaysService.save(readHolidayBody(requestBody));
  }

  /**
   * Sửa ngày nghỉ.
   * @returns  ngày nghỉ sau khi sửa
   * @throws   422 body sai · 404 không có ngày nghỉ · 409 trùng ngày với ngày nghỉ khác
   */
  @Put(HOLIDAY_ENDPOINTS.holiday)
  @ApiOkResponse({ schema: openApiSchemaOf(HolidaySchema) })
  update(@Param('holidayId') holidayId: string, @Body() requestBody: unknown): Promise<Holiday> {
    return this.holidaysService.save(readHolidayBody(requestBody), holidayId);
  }

  /**
   * Xóa ngày nghỉ.
   * @throws  404 không có ngày nghỉ
   */
  @Delete(HOLIDAY_ENDPOINTS.holiday)
  @HttpCode(204)
  @ApiNoContentResponse()
  remove(@Param('holidayId') holidayId: string): Promise<void> {
    return this.holidaysService.remove(holidayId);
  }
}
