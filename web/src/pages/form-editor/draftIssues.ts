/* Các ô bị lỗi của bản soạn (sau khi bấm Lưu), để các ô trong trình soạn tự tô đỏ mà không phải truyền qua từng tầng. */
import { createContext, useContext } from 'react';

/** Tập các ô bị lỗi, mỗi ô một chuỗi FORM_TYPE_ISSUE_TARGET; rỗng = không có lỗi hoặc chưa bấm Lưu. */
export const DraftIssuesContext = createContext<ReadonlySet<string>>(new Set());

/**
 * Các ô đang bị lỗi. Ô nào có trong tập thì gắn aria-invalid (viền đỏ; bấm Lưu sẽ đưa con trỏ tới ô lỗi đầu tiên).
 * @returns  tập chuỗi FORM_TYPE_ISSUE_TARGET
 */
export function useDraftIssues(): ReadonlySet<string> {
  return useContext(DraftIssuesContext);
}
