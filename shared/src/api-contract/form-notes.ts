/* HỢP ĐỒNG nhóm API Ghi chú nội bộ trên lá đơn: đường dẫn, dữ liệu gửi / nhận, câu thông báo.
   API giả (MSW), frontend và backend cùng theo file này.

   Cán bộ (vai trò có quyền internalNotes) để lại ghi chú trên một lá đơn, nối thành chuỗi theo thứ tự viết, như bình luận.
   Người nộp đơn không thấy, không biết có ghi chú. Nội dung là văn bản có định dạng (JSON của Tiptap).
   Ai viết thì người đó sửa, xóa được ghi chú của mình (canEditFormNote). */
import { z } from 'zod';
import { RichTextDocSchema, isRichTextEmpty } from '../aux-schema/rich-text';
import { StaffRefSchema } from './form';

/* ---------- Đường dẫn (phần sau /api) ---------- */

export const FORM_NOTE_ENDPOINTS = {
  /** GET → FormNotesResponse: các ghi chú của lá đơn, cũ trước mới sau.
      POST SaveFormNoteRequest → FormNote: thêm một ghi chú.
      Cần quyền internalNotes; không có đơn thì 404 */
  list: '/forms/:code/notes',
  /** PATCH SaveFormNoteRequest → FormNote: sửa nội dung · DELETE → 204: xóa.
      Cần quyền internalNotes và là người viết ghi chú (không thì 403); không có đơn, không có ghi chú thì 404 */
  note: '/forms/:code/notes/:noteId',
  /** GET ?codes=<mã đơn>,<mã đơn>… → FormNoteCountsResponse: số ghi chú của từng đơn (cột Ghi chú của bảng đơn).
      Mã đơn không có, hoặc chưa có ghi chú thì 0. Cần quyền internalNotes */
  counts: '/form-notes/counts',
} as const;

/** Tên tham số chứa các mã đơn của lệnh đếm ghi chú. */
export const FORM_NOTE_COUNTS_PARAM = 'codes';

/**
 * Đường dẫn API các ghi chú của một lá đơn.
 * @param code  mã đơn
 * @returns     vd '/forms/XMM-2026-001-00001/notes'
 */
export function formNotesPath(code: string): string {
  return FORM_NOTE_ENDPOINTS.list.replace(':code', encodeURIComponent(code));
}

/**
 * Đường dẫn API một ghi chú.
 * @param code    mã đơn
 * @param noteId  id ghi chú
 * @returns       vd '/forms/XMM-2026-001-00001/notes/note-1'
 */
export function formNotePath(code: string, noteId: string): string {
  return `${formNotesPath(code)}/${encodeURIComponent(noteId)}`;
}

/**
 * Đường dẫn API đếm ghi chú của nhiều lá đơn.
 * @param codes  các mã đơn (mã đơn không có dấu phẩy)
 * @returns      vd '/form-notes/counts?codes=XMM-2026-001-00001%2CXMM-2026-001-00002'
 */
export function formNoteCountsPath(codes: readonly string[]): string {
  return `${FORM_NOTE_ENDPOINTS.counts}?${new URLSearchParams({ [FORM_NOTE_COUNTS_PARAM]: codes.join(',') })}`;
}

/**
 * Đọc các mã đơn từ tham số của lệnh đếm ghi chú.
 * @param codesParam  giá trị tham số codes; không có thì null
 * @returns           các mã đơn, bỏ chỗ trống và mã trùng
 */
export function parseFormNoteCountsParam(codesParam: string | null): string[] {
  return [...new Set((codesParam ?? '').split(',').map((code) => code.trim()).filter(Boolean))];
}

/* ---------- Câu thông báo ---------- */

export const FORM_NOTE_MESSAGES = {
  /** Gọi API khi chưa đăng nhập */
  401: 'Bạn chưa đăng nhập.',
  /** Vai trò không có quyền internalNotes */
  403: 'Bạn không có quyền xem, viết ghi chú nội bộ.',
  /** Sửa, xóa ghi chú của người khác */
  notAuthor: 'Bạn chỉ sửa, xóa được ghi chú của mình.',
  formNotFound: 'Không tìm thấy đơn.',
  noteNotFound: 'Ghi chú không còn (có thể đã bị xóa).',
  /** Nội dung trống (chỉ có khoảng trắng) */
  empty: 'Ghi chú chưa có nội dung.',
  /** Body sai dạng */
  invalidRequest: 'Dữ liệu gửi lên không hợp lệ.',
} as const;

/* ---------- Dữ liệu gửi / nhận ---------- */

/** Một ghi chú. */
export const FormNoteSchema = z.object({
  id: z.string(),
  content: RichTextDocSchema,
  /** Cán bộ viết ghi chú */
  author: StaffRefSchema,
  /** Lúc viết, giờ Việt Nam 'YYYY-MM-DDTHH:mm' */
  createdAt: z.string(),
  /** Lần sửa gần nhất, giờ Việt Nam; null = chưa sửa lần nào */
  editedAt: z.string().nullable(),
});
export type FormNote = z.infer<typeof FormNoteSchema>;

/** Trả về từ GET /forms/:code/notes. */
export const FormNotesResponseSchema = z.object({ notes: z.array(FormNoteSchema) });
export type FormNotesResponse = z.infer<typeof FormNotesResponseSchema>;

/** Body của POST /forms/:code/notes và PATCH /forms/:code/notes/:noteId. Nội dung không được trống. */
export const SaveFormNoteRequestSchema = z.object({
  content: RichTextDocSchema.refine((doc) => !isRichTextEmpty(doc), FORM_NOTE_MESSAGES.empty),
});
export type SaveFormNoteRequest = z.infer<typeof SaveFormNoteRequestSchema>;

/** Trả về từ GET /form-notes/counts: số ghi chú theo mã đơn, đủ mọi mã đơn đã hỏi. */
export const FormNoteCountsResponseSchema = z.object({ counts: z.record(z.string(), z.number().int().nonnegative()) });
export type FormNoteCountsResponse = z.infer<typeof FormNoteCountsResponseSchema>;
