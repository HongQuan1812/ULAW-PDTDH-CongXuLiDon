/* Đổi qua lại ngày 'YYYY-MM-DD' của hợp đồng API và cột DATE của PostgreSQL (Prisma đọc, ghi thành Date lúc 00:00 UTC). */

/**
 * Ngày 'YYYY-MM-DD' → giá trị ghi vào cột DATE.
 * @param date  vd '2026-02-14'
 * @returns     Date 00:00 UTC của ngày đó
 */
export function toDbDate(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
}

/**
 * Giá trị đọc từ cột DATE → ngày 'YYYY-MM-DD'.
 * @param dbDate  Date 00:00 UTC Prisma trả về
 * @returns       vd '2026-02-14'
 */
export function fromDbDate(dbDate: Date): string {
  return dbDate.toISOString().slice(0, 10);
}
