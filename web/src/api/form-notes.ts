/* Hook gọi API Ghi chú nội bộ trên lá đơn (chỉ vai trò có quyền internalNotes). */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formNotePath, formNotesPath, type FormNote, type FormNotesResponse, type RichTextDoc } from '@ulaw/shared';
import { apiFetch } from './client';

/**
 * Khóa lưu tạm các ghi chú của một lá đơn.
 * @param code  mã đơn
 * @returns     vd ['formNotes', 'XMM-2026-001-00001']
 */
const formNotesKey = (code: string) => ['formNotes', code] as const;

/**
 * Các ghi chú của một lá đơn. Tải ngay khi mở trang (nút ghi chú hiện số ghi chú, chưa cần mở khung).
 * @param code  mã đơn
 * @returns     kết quả useQuery; data = các ghi chú, cũ trước mới sau
 */
export function useFormNotes(code: string) {
  return useQuery({
    queryKey: formNotesKey(code),
    queryFn: () => apiFetch<FormNotesResponse>(formNotesPath(code)),
    select: (response) => response.notes,
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
    onSuccess: (addedNote) => updateCachedNotes((notes) => [...notes, addedNote]),
  });

  const editNote = useMutation({
    mutationFn: ({ noteId, content }: { noteId: string; content: RichTextDoc }) =>
      apiFetch<FormNote>(formNotePath(code, noteId), { method: 'PATCH', body: JSON.stringify({ content }) }),
    onSuccess: (editedNote) => updateCachedNotes((notes) => notes.map((note) => (note.id === editedNote.id ? editedNote : note))),
  });

  const deleteNote = useMutation({
    mutationFn: (noteId: string) => apiFetch<void>(formNotePath(code, noteId), { method: 'DELETE' }),
    onSuccess: (_response, noteId) => updateCachedNotes((notes) => notes.filter((note) => note.id !== noteId)),
  });

  return { addNote, editNote, deleteNote };
}
