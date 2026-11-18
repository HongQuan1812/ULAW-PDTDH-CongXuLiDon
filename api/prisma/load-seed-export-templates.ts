/* Đọc mẫu xuất file đơn (Word) theo mẫu của Phòng Đào tạo: mỗi loại đơn của shared/src/seed/school-form-types.ts một mẫu,
   tệp ở shared/src/seed/export-templates/<mã loại đơn>.docx (dữ liệu seed; đọc ở đây vì shared/ dùng chung với web, không đọc tệp được). Seed dev (seed.ts) và seed bản thật (production-seed.ts) cùng đọc.
   Sửa mẫu: thay tệp .docx cùng tên. Dev restart là có; bản thật không ghi đè, cán bộ tải mẫu mới ở trình soạn loại đơn. */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Thư mục chứa các tệp mẫu (api/prisma → shared/src/seed). */
const TEMPLATE_DIR = fileURLToPath(new URL('../../shared/src/seed/export-templates/', import.meta.url));

/** Tên mẫu hiện ở danh sách mẫu xuất file của loại đơn. */
const TEMPLATE_NAME = 'Đơn theo mẫu của Phòng Đào tạo';

/** Một mẫu đọc từ thư mục, đủ thông tin để ghi vào bảng ExportTemplate (trừ người tải lên, lúc tải lên). */
export interface SeedExportTemplate {
  /** id mẫu: 'tpl-<mã loại đơn>' */
  id: string;
  /** mã loại đơn, lấy từ tên tệp */
  formTypeId: string;
  name: string;
  /** tên tệp khi tải mẫu về */
  fileName: string;
  /** nội dung tệp .docx */
  content: Uint8Array<ArrayBuffer>;
}

/**
 * Đọc mọi mẫu trong thư mục, sắp theo mã loại đơn.
 * @returns  các mẫu, mỗi tệp .docx một mẫu
 */
export function loadSeedExportTemplates(): SeedExportTemplate[] {
  return readdirSync(TEMPLATE_DIR)
    .filter((fileName) => fileName.endsWith('.docx'))
    .sort()
    .map((fileName) => {
      const formTypeId = path.basename(fileName, '.docx');
      return {
        id: `tpl-${formTypeId}`,
        formTypeId,
        name: TEMPLATE_NAME,
        fileName: `mau-don-${formTypeId}.docx`,
        content: new Uint8Array(readFileSync(path.join(TEMPLATE_DIR, fileName))),
      };
    });
}
