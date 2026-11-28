/* Loại đơn mẫu và các phiên bản của chúng. */
import type { FormType } from '../api-contract';
import type { FormSection, FormTypeStatus } from '../aux-schema';
import { FormTypeSchema } from '../api-contract';
import { cloneSeedValue } from './clone';
import { SCHOOL_FORM_TYPES_SEED } from './school-form-types';
import { addHours } from './time';

/** Thời gian xử lí tối đa của loại đơn ở dev (ngày làm việc), để thấy hạn xử lí đơn; loại đơn không có trong bảng thì DEV_DEFAULT_MAX_PROCESSING_DAYS.
    null = không có hạn, để thấy đơn không có hạn trông thế nào. Bản thật để trống, Phòng tự đặt. */
const DEV_MAX_PROCESSING_DAYS: Readonly<Record<string, number | null>> = { xmr: 10, dn: null };
const DEV_DEFAULT_MAX_PROCESSING_DAYS = 5;

/* Loại đơn ban đầu: các loại đơn thật theo mẫu Word (SCHOOL_FORM_TYPES_SEED), seed bản thật cũng dùng (trừ vài mã, xem production-form-types.ts).
   Ở dev mọi loại đơn đều Đang mở (bản thật để Nháp), để nộp thử được ngay, và có hạn xử lí (bản thật để trống). */
export const FORM_TYPE_SEED: readonly FormType[] = SCHOOL_FORM_TYPES_SEED.map((formType) =>
  FormTypeSchema.parse({ ...formType, status: 'open', maxProcessingDays: formType.id in DEV_MAX_PROCESSING_DAYS ? DEV_MAX_PROCESSING_DAYS[formType.id] : DEV_DEFAULT_MAX_PROCESSING_DAYS }),
);

/** Loại đơn chính của dữ liệu mẫu: có nhiều đơn nhất (đủ trang, đủ trạng thái), có sẵn mẫu xuất Word. */
export const MAIN_SEED_FORM_TYPE_ID = 'xmr';

/** Loại đơn có thêm phiên bản 1 cũ (Đã đóng), để thấy cách hiện nhiều phiên bản; phiên bản đang mở là 2. */
export const MULTI_VERSION_SEED_FORM_TYPE_ID = 'th';

/** Một phiên bản loại đơn trong API giả: nội dung, trạng thái, lần lưu gần nhất (id cán bộ). */
export interface SeedFormTypeVersion {
  version: number;
  status: FormTypeStatus;
  name: string;
  description: string | null;
  sections: FormSection[];
  updatedAt: string;
  updatedById: string;
}

/** Một loại đơn trong API giả: mã loại đơn, mã đơn, thời gian xử lí tối đa, các phiên bản (cũ trước, mới sau). */
export interface SeedFormType {
  id: string;
  prefix: string;
  /** Thời gian xử lí tối đa của loại đơn (mọi phiên bản), ngày làm việc; null = không có hạn */
  maxProcessingDays: number | null;
  versions: SeedFormTypeVersion[];
}

/**
 * Lần lưu gần nhất của loại đơn mẫu thứ i:
 * loại đơn đầu tiên lưu ngày 01/09/2026; các loại khác lùi dần mỗi loại 6 ngày, giờ lưu trong giờ hành chính, lần lượt 3 cán bộ mẫu.
 * @param i  vị trí trong FORM_TYPE_SEED
 * @returns  lúc lưu, id cán bộ lưu
 */
function seedUpdate(i: number): { updatedAt: string; updatedById: string } {
  if (i === 0) return { updatedAt: '2026-09-01T08:00', updatedById: 'cb-1' };
  return {
    updatedAt: `${addHours('2026-11-05T00:00', -(i - 1) * 144).slice(0, 10)}T${String(8 + ((i * 3) % 9)).padStart(2, '0')}:${String((i * 17) % 60).padStart(2, '0')}`,
    updatedById: `cb-${((i - 1) % 3) + 1}`,
  };
}

/**
 * Dựng các loại đơn ban đầu, mỗi loại một phiên bản (phiên bản 1) theo FORM_TYPE_SEED.
 * Riêng MULTI_VERSION_SEED_FORM_TYPE_ID có thêm phiên bản 1 cũ (Đã đóng, chỉ có phần đầu), để thấy cách hiện nhiều phiên bản.
 * @returns  các loại đơn
 */
export function seedFormTypes(): SeedFormType[] {
  return FORM_TYPE_SEED.map((formType, i) => {
    const { id, prefix, name, description, status, maxProcessingDays, sections } = cloneSeedValue(formType);
    const latest: SeedFormTypeVersion = { version: 1, status, name, description, sections, ...seedUpdate(i) };
    if (id !== MULTI_VERSION_SEED_FORM_TYPE_ID) return { id, prefix, maxProcessingDays, versions: [latest] };
    const firstVersion: SeedFormTypeVersion = {
      ...cloneSeedValue(latest),
      status: 'closed',
      sections: cloneSeedValue(sections.slice(0, 1)),
      updatedAt: '2026-08-14T09:30',
      updatedById: 'cb-2',
    };
    return { id, prefix, maxProcessingDays, versions: [firstVersion, { ...latest, version: 2 }] };
  });
}
