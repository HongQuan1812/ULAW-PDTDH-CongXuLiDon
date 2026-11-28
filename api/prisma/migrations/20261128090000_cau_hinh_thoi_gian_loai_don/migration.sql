-- Cấu hình thời gian của loại đơn: thời gian xử lí tối đa chuyển từ phiên bản lên loại đơn, thêm giờ tự mở / tự đóng.

-- Cột mới ở FormType
ALTER TABLE "FormType" ADD COLUMN "maxProcessingDays" INTEGER,
ADD COLUMN "autoOpenAt" TIMESTAMPTZ(3),
ADD COLUMN "autoOpenVersion" INTEGER,
ADD COLUMN "autoOpenDone" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "autoCloseAt" TIMESTAMPTZ(3),
ADD COLUMN "autoCloseDone" BOOLEAN NOT NULL DEFAULT false;

-- Thời gian xử lí lấy theo phiên bản mới nhất của từng loại đơn (đơn đã nộp giữ giá trị trong bản chụp, không đổi)
UPDATE "FormType" AS ft
SET "maxProcessingDays" = latest."maxProcessingDays"
FROM (
  SELECT DISTINCT ON ("formTypeId") "formTypeId", "maxProcessingDays"
  FROM "FormTypeVersion"
  ORDER BY "formTypeId", "version" DESC
) AS latest
WHERE latest."formTypeId" = ft."id";

-- Bỏ cột ở phiên bản
ALTER TABLE "FormTypeVersion" DROP COLUMN "maxProcessingDays";
