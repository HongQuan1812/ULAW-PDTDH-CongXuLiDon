/* Nhận biết lỗi của Prisma mà service cần đổi thành mã HTTP riêng. */

/** Mã lỗi của Prisma khi vi phạm ràng buộc duy nhất (vd email, CCCD, mã đơn đã có). */
const PRISMA_UNIQUE_VIOLATION = 'P2002';

/**
 * Kiểm tra lỗi có phải vi phạm ràng buộc duy nhất của Prisma không.
 * @param error  lỗi bắt được
 * @returns      true nếu là P2002
 */
export function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === PRISMA_UNIQUE_VIOLATION;
}
