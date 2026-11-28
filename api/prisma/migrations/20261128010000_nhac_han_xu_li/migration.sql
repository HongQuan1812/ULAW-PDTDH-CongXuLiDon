-- Hạn xử lí đã gửi thư nhắc Sắp tới hạn / Quá hạn, để restart backend không gửi trùng
ALTER TABLE "Form" ADD COLUMN "dueSoonRemindedFor" TIMESTAMPTZ(3),
ADD COLUMN "overdueRemindedFor" TIMESTAMPTZ(3);
