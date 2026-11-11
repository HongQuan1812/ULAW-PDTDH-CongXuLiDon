/* Phân loại tệp để xem trước (theo đuôi tệp). Dùng chung giao diện và máy chủ. */

/** Cách xem trước một tệp: ảnh · PDF · Word (.docx) · none = chưa xem trước được (cho tải về). */
export type PreviewKind = 'image' | 'pdf' | 'word' | 'none';

const PREVIEW_KIND_BY_EXTENSION: Record<string, PreviewKind> = {
  jpg: 'image',
  jpeg: 'image',
  png: 'image',
  pdf: 'pdf',
  docx: 'word',
};

/**
 * Cách xem trước của một tệp.
 * @param fileName  tên tệp, vd 'bang-diem.pdf'
 * @returns         loại xem trước; đuôi lạ, không có đuôi, .doc cũ thì 'none'
 */
export function previewKindOf(fileName: string): PreviewKind {
  const extension = fileName.includes('.') ? fileName.split('.').pop()!.toLowerCase() : '';
  return PREVIEW_KIND_BY_EXTENSION[extension] ?? 'none';
}
