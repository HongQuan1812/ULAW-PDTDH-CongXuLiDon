/* PDF mẫu cho API giả: tệp trong dữ liệu mẫu chỉ có tên, không có nội dung thật,
   nên khi xem trước thì API giả dựng một trang PDF đơn giản, ghi tên tệp. */

import { buildSamplePdfText } from '@ulaw/shared';

/**
 * Dựng một tệp PDF một trang có hai dòng chữ (chỉ chữ không dấu, vì PDF dùng phông Helvetica chuẩn).
 * @param fileName  tên tệp, vd 'Bang_diem_hoc_ky_2.pdf' (đuôi giữ nguyên, chữ có dấu được bỏ dấu)
 * @returns         tệp PDF hợp lệ, kiểu application/pdf
 */
export function buildSamplePdf(fileName: string): File {
  return new File([buildSamplePdfText(fileName)], fileName, { type: 'application/pdf' });
}
