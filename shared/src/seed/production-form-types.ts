/* Loại đơn đưa lên bản thật: các loại đơn theo mẫu Word (school-form-types.ts), trừ những loại đơn chưa mở cho sinh viên nộp trên cổng.
   Seed dev vẫn có đủ mọi loại đơn. Tách riêng tệp này vì school-form-types.ts được xuất lại từ trình soạn. */
import type { FormType } from '../api-contract';
import { SCHOOL_FORM_TYPES_SEED } from './school-form-types';

/** Mã đơn không đưa lên bản thật. */
export const PRODUCTION_EXCLUDED_FORM_TYPE_PREFIXES: readonly string[] = ['CCT', 'CHT', 'CTR', 'XMT', 'XMR', 'CDCT', 'HXTN', 'KKL', 'DN', 'DNPA'];

/** Loại đơn seed bản thật thêm vào (api/prisma/production-seed.ts). */
export const PRODUCTION_FORM_TYPES_SEED: readonly FormType[] = SCHOOL_FORM_TYPES_SEED.filter(
  (formType) => !PRODUCTION_EXCLUDED_FORM_TYPE_PREFIXES.includes(formType.prefix),
);
