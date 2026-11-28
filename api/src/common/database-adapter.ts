/* Cách nối database dùng chung cho backend, seed, test: Prisma qua driver adapter pg.
   Phiên kết nối luôn dùng múi giờ UTC. Prisma gửi giờ dạng UTC nhưng không ghi kèm múi giờ; nếu phiên dùng múi giờ của máy chủ
   database (Asia/Ho_Chi_Minh) thì Postgres hiểu nhầm là giờ Việt Nam và lưu sớm 7 tiếng. Database lưu giờ chuẩn; app tự đổi sang
   giờ Việt Nam khi hiện (common/vietnam-time.ts). psql, công cụ xem database vẫn hiện theo giờ Việt Nam của máy chủ database. */
import { PrismaPg } from '@prisma/adapter-pg';

/**
 * Tạo driver adapter cho Prisma Client, phiên kết nối dùng múi giờ UTC.
 * @param connectionString  chuỗi kết nối (DATABASE_URL)
 * @returns                 adapter truyền cho new PrismaClient({ adapter })
 */
export function createDatabaseAdapter(connectionString: string | undefined): PrismaPg {
  return new PrismaPg({ connectionString, options: '-c timezone=UTC' });
}
