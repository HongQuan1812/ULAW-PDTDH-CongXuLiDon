/* Chọn các đơn để xuất danh sách đơn: theo phiên bản và khoảng ngày nộp, rồi tên sheet của từng phiên bản.
   Backend (api/src/exports) và API giả cùng dùng. */
import type { ExportFormListRequest } from '../api-contract/exports';

/** Phần của một lá đơn cần để chọn: phiên bản lúc nộp và lúc nộp (giờ Việt Nam 'YYYY-MM-DDTHH:mm'). */
export interface FormListRef {
  version: number;
  submittedAt: string;
}

/**
 * Chọn các đơn theo điều kiện của popup Xuất danh sách đơn.
 * @param forms   các đơn đã sắp theo thứ tự cần xuất
 * @param filter  phiên bản (số hoặc 'all') và khoảng ngày nộp (YYYY-MM-DD, tính cả hai đầu; null = không giới hạn)
 * @returns       các đơn thỏa điều kiện, giữ nguyên thứ tự
 */
export function selectFormsForList<Form extends FormListRef>(forms: readonly Form[], filter: ExportFormListRequest): Form[] {
  return forms.filter((form) => {
    const submittedDay = form.submittedAt.slice(0, 10);
    if (filter.version !== 'all' && form.version !== filter.version) return false;
    if (filter.submittedFrom && submittedDay < filter.submittedFrom) return false;
    if (filter.submittedTo && submittedDay > filter.submittedTo) return false;
    return true;
  });
}

/**
 * Tên sheet của một phiên bản trong file danh sách đơn.
 * @param version  số phiên bản
 * @returns        vd 'Phiên bản 2'
 */
export function formListSheetName(version: number): string {
  return `Phiên bản ${version}`;
}
