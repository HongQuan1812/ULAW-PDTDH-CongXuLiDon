/* Hook gọi API Ghi chú nội bộ trên lá đơn (chỉ vai trò có quyền internalNotes). */
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { formNotePath, formNotesPath, type FormNote, type FormNotesResponse, type RichTextDoc } from '@ulaw/shared';
import { apiFetch } from './client';
import { ALL_FORMS_KEY, HANDLED_FORMS_KEY } from './forms';

/**
 * Khóa lưu tạm các ghi chú của một lá đơn.
 * @param code  mã đơn
 * @returns     vd ['formNotes', 'XMM-2026-001-00001']
 */
const formNotesKey = (code: string) => ['formNotes', code] as const;

/** Đoạn khóa của bảng Đơn phụ trách ở trang hồ sơ một người, vd ['profile', 'person', 'cb-1', 'handled-forms']. */
const PERSON_HANDLED_FORMS_SEGMENT = 'handled-forms';

/**
 * Tải lại các bảng đơn có cột Ghi chú (số ghi chú vừa đổi): Quản lí đơn, Đơn phụ trách của mình và ở trang hồ sơ người khác.
 * @param queryClient  cache của TanStack Query
 */
function refreshNoteCountTables(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: ALL_FORMS_KEY });
  void queryClient.invalidateQueries({ queryKey: HANDLED_FORMS_KEY });
  void queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] === 'profile' && query.queryKey.includes(PERSON_HANDLED_FORMS_SEGMENT) });
}

/** Bao lâu (ms) tải lại ghi chú để thấy ghi chú người khác vừa viết: khi đang mở khung ghi chú, và khi khung đang đóng. */
const NOTES_REFRESH_MS_PANEL_OPEN = 3_000;
const NOTES_REFRESH_MS_PANEL_CLOSED = 30_000;

/**
 * Các ghi chú của một lá đơn. Tải ngay khi mở trang (nút ghi chú hiện số ghi chú, chưa cần mở khung).
 * Tự tải lại định kì (mở khung thì nhanh hơn) để thấy ghi chú mới của người khác mà không cần tải lại trang;
 * tab đang ẩn thì ngừng, quay lại tab thì tải lại ngay.
 * @param code       mã đơn
 * @param panelOpen  true: đang mở khung ghi chú
 * @returns          kết quả useQuery; data = các ghi chú, cũ trước mới sau
 */
export function useFormNotes(code: string, panelOpen: boolean) {
  return useQuery({
    queryKey: formNotesKey(code),
    queryFn: () => apiFetch<FormNotesResponse>(formNotesPath(code)),
    select: (response) => response.notes,
    refetchInterval: panelOpen ? NOTES_REFRESH_MS_PANEL_OPEN : NOTES_REFRESH_MS_PANEL_CLOSED,
    refetchOnWindowFocus: true,
  });
}

/**
 * Thêm, sửa, xóa ghi chú của một lá đơn. Xong thì cập nhật luôn danh sách đã tải, không gọi lại API.
 * @param code  mã đơn
 * @returns     addNote.mutate(content) · editNote.mutate({ noteId, content }) · deleteNote.mutate(noteId)
 */
export function useFormNoteActions(code: string) {
  const queryClient = useQueryClient();

  /**
   * Thay danh sách ghi chú đã tải.
   * @param changeNotes  nhận danh sách cũ, trả danh sách mới
   */
  const updateCachedNotes = (changeNotes: (notes: FormNote[]) => FormNote[]) =>
    queryClient.setQueryData<FormNotesResponse>(formNotesKey(code), (cached) => cached && { notes: changeNotes(cached.notes) });

  const addNote = useMutation({
    mutationFn: (content: RichTextDoc) => apiFetch<FormNote>(formNotesPath(code), { method: 'POST', body: JSON.stringify({ content }) }),
    onSuccess: (addedNote) => {
      updateCachedNotes((notes) => [...notes, addedNote]);
      refreshNoteCountTables(queryClient);
    },
  });

  const editNote = useMutation({
    mutationFn: ({ noteId, content }: { noteId: string; content: RichTextDoc }) =>
      apiFetch<FormNote>(formNotePath(code, noteId), { method: 'PATCH', body: JSON.stringify({ content }) }),
    onSuccess: (editedNote) => updateCachedNotes((notes) => notes.map((note) => (note.id === editedNote.id ? editedNote : note))),
  });

  const deleteNote = useMutation({
    mutationFn: (noteId: string) => apiFetch<void>(formNotePath(code, noteId), { method: 'DELETE' }),
    onSuccess: (_response, noteId) => {
      updateCachedNotes((notes) => notes.filter((note) => note.id !== noteId));
      refreshNoteCountTables(queryClient);
    },
  });

  return { addNote, editNote, deleteNote };
}
