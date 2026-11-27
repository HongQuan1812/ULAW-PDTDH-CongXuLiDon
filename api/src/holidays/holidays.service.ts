/* Ngày nghỉ: đọc, thêm, sửa, xóa. Quyền manageHolidays đã được guard kiểm tra ở controller;
   ở đây kiểm tra không trùng ngày với ngày nghỉ khác (findOverlappingHoliday của shared, giống API giả). */
import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { HOLIDAY_MESSAGES, findOverlappingHoliday, type Holiday, type HolidayInput, type HolidaysResponse } from '@ulaw/shared';
import { ApiException } from '../common/api-exception';
import { PrismaService } from '../common/prisma.service';
import type { Holiday as HolidayRow } from '../generated/prisma/client';
import { fromDbDate, toDbDate } from './holiday-dates';

/**
 * Đổi dòng database sang dạng hợp đồng API.
 * @param row  dòng Holiday
 * @returns    theo HolidaySchema
 */
function toHoliday(row: HolidayRow): Holiday {
  return { id: row.id, name: row.name, startDate: fromDbDate(row.startDate), endDate: fromDbDate(row.endDate) };
}

@Injectable()
export class HolidaysService {
  /** @param prisma  truy cập database */
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Mọi ngày nghỉ.
   * @returns  sớm trước muộn sau
   */
  async findAll(): Promise<HolidaysResponse> {
    const rows = await this.prisma.holiday.findMany({ orderBy: [{ startDate: 'asc' }, { endDate: 'asc' }] });
    return { holidays: rows.map(toHoliday) };
  }

  /**
   * Thêm hoặc sửa một ngày nghỉ, trong một transaction để hai lần lưu cùng lúc không trùng ngày nhau.
   * @param holidayInput  ngày nghỉ (đã kiểm tra bằng HolidayInputSchema)
   * @param holidayId     id ngày nghỉ cần sửa; không có = thêm mới
   * @returns             ngày nghỉ sau khi lưu
   * @throws              404 không có ngày nghỉ cần sửa · 409 trùng ngày với ngày nghỉ khác
   */
  save(holidayInput: HolidayInput, holidayId?: string): Promise<Holiday> {
    return this.prisma.$transaction(
      async (transaction) => {
        // Ngày nghỉ cần sửa phải còn; không được trùng ngày nghỉ khác
        const existing = (await transaction.holiday.findMany()).map(toHoliday);
        if (holidayId && !existing.some((holiday) => holiday.id === holidayId)) throw new ApiException(404, HOLIDAY_MESSAGES[404]);
        const overlapping = findOverlappingHoliday(holidayInput, existing, holidayId);
        if (overlapping) throw new ApiException(409, HOLIDAY_MESSAGES.overlaps(overlapping.name));

        // Ghi
        const fields = { name: holidayInput.name, startDate: toDbDate(holidayInput.startDate), endDate: toDbDate(holidayInput.endDate) };
        const row = holidayId
          ? await transaction.holiday.update({ where: { id: holidayId }, data: fields })
          : await transaction.holiday.create({ data: { id: `holiday-${randomUUID()}`, ...fields } });
        return toHoliday(row);
      },
      { isolationLevel: 'Serializable' },
    );
  }

  /**
   * Xóa một ngày nghỉ.
   * @param holidayId  id ngày nghỉ
   * @throws           404 không có ngày nghỉ
   */
  async remove(holidayId: string): Promise<void> {
    const { count } = await this.prisma.holiday.deleteMany({ where: { id: holidayId } });
    if (count === 0) throw new ApiException(404, HOLIDAY_MESSAGES[404]);
  }
}
