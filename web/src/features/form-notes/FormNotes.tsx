/* Ghi chú nội bộ trên lá đơn (chỉ cán bộ có quyền internalNotes; người nộp đơn không thấy).
   Nút tròn ở góc phải dưới, có số ghi chú; bấm thì mở khung nhỏ kiểu Notion: chuỗi ghi chú cũ trước mới sau, ô soạn ở đáy.
   Khung kéo góc trên bên trái để co giãn; cỡ khung nhớ trong trình duyệt. Ghi chú của mình thì sửa, xóa được. */
import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react';
import { EMPTY_RICH_TEXT_DOC, canEditFormNote, isRichTextEmpty, type FormNote, type RichTextDoc } from '@ulaw/shared';
import { useFormNoteActions, useFormNotes } from '../../api/form-notes';
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { LoadError, loadErrorMessage } from '../../components/LoadError';
import { RefreshButton } from '../../components/RefreshButton';
import { RichTextEditor } from '../../components/rich-text/RichTextEditor';
import { RichTextView } from '../../components/rich-text/RichTextView';
import { useAuth } from '../auth/useAuth';
import { formatDateTime } from '../../lib/format';
import styles from './FormNotes.module.css';

/** Câu báo khi gửi lỗi mà máy chủ không gửi kèm câu nào (vd mất mạng). */
const SEND_FAILED_TEXT = 'Chưa lưu được ghi chú. Kiểm tra kết nối mạng rồi thử lại.';

/** Cỡ khung lúc đầu, nhỏ nhất (px). Lớn nhất: theo màn hình (CSS). */
const DEFAULT_PANEL_SIZE = { width: 380, height: 520 };
const MIN_PANEL_SIZE = { width: 300, height: 320 };

/** Chỗ nhớ cỡ khung trong trình duyệt (mỗi người xem một cỡ riêng). */
const PANEL_SIZE_STORAGE_KEY = 'form-notes-panel-size';

/**
 * Bấm Ctrl+Enter (Cmd+Enter trên Mac) thì làm một việc, thay cho xuống dòng của ô soạn.
 * Bắt ở pha capture để ô soạn không nhận phím này nữa.
 * @param run  việc cần làm, vd gửi ghi chú
 * @returns    hàm gắn vào onKeyDownCapture
 */
function onModEnter(run: () => void) {
  return (event: KeyboardEvent) => {
    if (event.key !== 'Enter' || !(event.ctrlKey || event.metaKey)) return;
    event.preventDefault();
    event.stopPropagation();
    run();
  };
}

/**
 * Đọc cỡ khung đã nhớ.
 * @returns  cỡ đã nhớ; chưa có, hoặc trình duyệt chặn bộ nhớ, thì cỡ mặc định
 */
function readPanelSize(): { width: number; height: number } {
  try {
    const saved = JSON.parse(localStorage.getItem(PANEL_SIZE_STORAGE_KEY) ?? 'null') as { width?: unknown; height?: unknown } | null;
    if (typeof saved?.width === 'number' && typeof saved.height === 'number') return { width: saved.width, height: saved.height };
  } catch {
    // Bộ nhớ bị chặn hoặc dữ liệu hỏng: dùng cỡ mặc định
  }
  return DEFAULT_PANEL_SIZE;
}

/**
 * Cỡ khung và tay nắm để kéo co giãn. Tay nắm ở góc trên bên trái (khung neo góc phải dưới), kéo ra xa thì khung to lên.
 * @returns  size: cỡ hiện tại · handleProps: gắn vào tay nắm
 */
function usePanelResize() {
  const [size, setSize] = useState(readPanelSize);
  const dragStartRef = useRef<{ pointerX: number; pointerY: number; width: number; height: number } | null>(null);

  /** Bắt đầu kéo: nhớ chỗ con trỏ và cỡ lúc đầu, giữ con trỏ cho tay nắm đến khi thả. */
  const onPointerDown = (event: PointerEvent<HTMLElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStartRef.current = { pointerX: event.clientX, pointerY: event.clientY, ...size };
  };

  /** Đang kéo: con trỏ đi lên, sang trái bao nhiêu thì khung to ra bấy nhiêu (không nhỏ hơn cỡ nhỏ nhất). */
  const onPointerMove = (event: PointerEvent<HTMLElement>) => {
    const dragStart = dragStartRef.current;
    if (!dragStart) return;
    setSize({
      width: Math.max(MIN_PANEL_SIZE.width, Math.min(window.innerWidth - 32, dragStart.width + dragStart.pointerX - event.clientX)),
      height: Math.max(MIN_PANEL_SIZE.height, Math.min(window.innerHeight - 120, dragStart.height + dragStart.pointerY - event.clientY)),
    });
  };

  /** Thả: nhớ cỡ mới cho lần mở sau. */
  const onPointerUp = () => {
    if (!dragStartRef.current) return;
    dragStartRef.current = null;
    try {
      localStorage.setItem(PANEL_SIZE_STORAGE_KEY, JSON.stringify(size));
    } catch {
      // Bộ nhớ bị chặn: lần sau mở lại cỡ mặc định
    }
  };

  return { size, handleProps: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp } };
}

/**
 * Nút tròn và khung ghi chú nội bộ của một lá đơn. Chỉ đặt vào trang khi người xem có quyền internalNotes.
 * @param code  mã đơn
 * @returns     nút tròn cố định ở góc phải dưới, và khung ghi chú khi đang mở
 */
export function FormNotes({ code }: { code: string }) {
  const [open, setOpen] = useState(false);
  const notesQuery = useFormNotes(code);
  const { size, handleProps } = usePanelResize();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const noteCount = notesQuery.data?.length ?? 0;

  /** Đóng khung, trả con trỏ bàn phím về nút tròn. */
  const closePanel = () => {
    setOpen(false);
    buttonRef.current?.focus();
  };

  return (
    <>
      {open && (
        <section
          className={styles.panel}
          style={{ '--panel-width': `${size.width}px`, '--panel-height': `${size.height}px` } as CSSProperties}
          aria-label="Ghi chú nội bộ"
          onKeyDown={(event) => event.key === 'Escape' && closePanel()}
        >
          <span className={styles.resizeHandle} title="Kéo để đổi cỡ khung" aria-hidden="true" {...handleProps} />
          <header className={styles.panelHead}>
            <div>
              <h2 className={styles.panelTitle}>Ghi chú nội bộ</h2>
              <p className={styles.panelSubtitle}>Chỉ cán bộ thấy, người nộp đơn không thấy.</p>
            </div>
            <button type="button" className={styles.iconButton} onClick={closePanel} aria-label="Đóng khung ghi chú" title="Đóng (Esc)">
              ✕
            </button>
          </header>
          <NoteList code={code} notesQuery={notesQuery} />
          <NoteComposer code={code} />
        </section>
      )}

      <button
        ref={buttonRef}
        type="button"
        className={`${styles.fab} ${open ? styles.fabOpen : ''}`}
        onClick={() => (open ? closePanel() : setOpen(true))}
        aria-expanded={open}
        aria-label={noteCount ? `Ghi chú nội bộ (${noteCount})` : 'Ghi chú nội bộ'}
        title="Ghi chú nội bộ"
      >
        <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
          <path
            d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.2 3.6c-.5.4-1.3.1-1.3-.6V16H6.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <path d="M8 8h8M8 11.5h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        {noteCount > 0 && <span className={styles.badge}>{noteCount}</span>}
      </button>
    </>
  );
}

/**
 * Chuỗi ghi chú, cũ trước mới sau. Mở khung hoặc có ghi chú mới thì cuộn xuống cuối.
 * @param code        mã đơn
 * @param notesQuery  kết quả tải ghi chú
 * @returns           vùng cuộn chứa các ghi chú, hoặc câu đang tải / lỗi / chưa có ghi chú
 */
function NoteList({ code, notesQuery }: { code: string; notesQuery: ReturnType<typeof useFormNotes> }) {
  const listRef = useRef<HTMLDivElement>(null);
  const noteCount = notesQuery.data?.length ?? 0;

  // Cuộn xuống ghi chú mới nhất
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [noteCount]);

  const errorMessage = loadErrorMessage(notesQuery);
  return (
    <div ref={listRef} className={styles.list}>
      {notesQuery.isPending ? (
        <p className={styles.muted}>Đang tải ghi chú…</p>
      ) : errorMessage ? (
        <div className={styles.loadError}>
          <LoadError message={errorMessage} compact />
          <RefreshButton query={notesQuery} label="ghi chú" size="small" />
        </div>
      ) : noteCount === 0 ? (
        <p className={styles.muted}>Chưa có ghi chú nào. Ghi chú đầu tiên ở ô bên dưới.</p>
      ) : (
        notesQuery.data?.map((note) => <NoteItem key={note.id} code={code} note={note} />)
      )}
    </div>
  );
}

/**
 * Một ghi chú: người viết, lúc viết, nội dung. Ghi chú của mình có nút Sửa (soạn ngay tại chỗ) và Xóa (hỏi lại trước khi xóa).
 * @param code  mã đơn
 * @param note  ghi chú
 * @returns     khối ghi chú
 */
function NoteItem({ code, note }: { code: string; note: FormNote }) {
  const { user, role } = useAuth();
  const { editNote, deleteNote } = useFormNoteActions(code);
  const [mode, setMode] = useState<'view' | 'edit' | 'confirmDelete'>('view');
  const [draft, setDraft] = useState<RichTextDoc>(note.content);
  const [errorText, setErrorText] = useState<string | null>(null);
  const editable = canEditFormNote({ id: user.id, role }, note);

  /** Bắt đầu sửa từ nội dung đang lưu. */
  const startEdit = () => {
    setDraft(note.content);
    setErrorText(null);
    setMode('edit');
  };

  /** Lưu nội dung đã sửa; trống thì báo, không gửi. */
  const saveEdit = () => {
    if (editNote.isPending) return;
    if (isRichTextEmpty(draft)) {
      setErrorText('Ghi chú chưa có nội dung.');
      return;
    }
    editNote.mutate(
      { noteId: note.id, content: draft },
      { onSuccess: () => setMode('view'), onError: (error) => setErrorText(error.message || SEND_FAILED_TEXT) },
    );
  };

  /** Xóa sau khi đã hỏi lại. */
  const confirmDelete = () =>
    deleteNote.mutate(note.id, { onError: (error) => setErrorText(error.message || SEND_FAILED_TEXT) });

  return (
    <article className={styles.note}>
      <div className={styles.noteHead}>
        <Avatar name={note.author.name} size="sm" />
        {/* Dòng trên: họ tên, lúc viết · dòng dưới: email */}
        <div className={styles.authorBlock}>
          <div className={styles.authorLine}>
            <span className={styles.author}>{note.author.name}</span>
            <time className={styles.time} dateTime={note.createdAt}>
              {formatDateTime(note.createdAt)}
              {note.editedAt && <span title={`Sửa lúc ${formatDateTime(note.editedAt)}`}> · đã sửa</span>}
            </time>
          </div>
          <span className={styles.email}>{note.author.email}</span>
        </div>
        {editable && mode === 'view' && (
          <span className={styles.noteActions}>
            <button type="button" onClick={startEdit}>Sửa</button>
            <button type="button" className={styles.dangerText} onClick={() => { setErrorText(null); setMode('confirmDelete'); }}>Xóa</button>
          </span>
        )}
      </div>

      {/* Nội dung: đang sửa thì ô soạn kèm Hủy / Lưu, còn lại chỉ xem */}
      {mode === 'edit' ? (
        <div className={styles.noteBody} onKeyDownCapture={onModEnter(saveEdit)}>
          <RichTextEditor value={draft} onChange={setDraft} label="Sửa ghi chú" invalid={!!errorText} />
          <div className={styles.rowButtons}>
            <Button variant="ghost" onClick={() => setMode('view')} disabled={editNote.isPending}>Hủy</Button>
            <Button variant="primary" onClick={saveEdit} disabled={editNote.isPending}>{editNote.isPending ? 'Đang lưu…' : 'Lưu'}</Button>
          </div>
        </div>
      ) : (
        <div className={styles.noteBody}>
          <RichTextView value={note.content} />
        </div>
      )}

      {/* Hỏi lại trước khi xóa */}
      {mode === 'confirmDelete' && (
        <div className={styles.confirm} role="group" aria-label="Xác nhận xóa ghi chú">
          <span>Xóa ghi chú này?</span>
          <Button variant="ghost" onClick={() => setMode('view')} disabled={deleteNote.isPending}>Hủy</Button>
          <Button variant="danger" onClick={confirmDelete} disabled={deleteNote.isPending}>{deleteNote.isPending ? 'Đang xóa…' : 'Xóa'}</Button>
        </div>
      )}
      {errorText && <p className={styles.error} role="alert">{errorText}</p>}
    </article>
  );
}

/**
 * Ô soạn ghi chú mới ở đáy khung. Gửi bằng nút hoặc Ctrl+Enter; gửi xong thì ô trống lại.
 * @param code  mã đơn
 * @returns     ô soạn và nút Gửi
 */
function NoteComposer({ code }: { code: string }) {
  const { addNote } = useFormNoteActions(code);
  const [draft, setDraft] = useState<RichTextDoc>(EMPTY_RICH_TEXT_DOC);
  const [errorText, setErrorText] = useState<string | null>(null);
  const empty = isRichTextEmpty(draft);

  /** Gửi ghi chú (trống hoặc đang gửi thì bỏ qua). */
  const send = () => {
    if (empty || addNote.isPending) return;
    setErrorText(null);
    addNote.mutate(draft, {
      onSuccess: () => setDraft(EMPTY_RICH_TEXT_DOC),
      onError: (error) => setErrorText(error.message || SEND_FAILED_TEXT),
    });
  };

  return (
    <div className={styles.composer} onKeyDownCapture={onModEnter(send)}>
      <RichTextEditor value={draft} onChange={setDraft} label="Ghi chú mới" placeholder="Viết ghi chú…" />
      {errorText && <p className={styles.error} role="alert">{errorText}</p>}
      <div className={styles.composerFoot}>
        <span className={styles.hint}>Ctrl+Enter để gửi</span>
        <Button variant="primary" onClick={send} disabled={empty || addNote.isPending}>
          {addNote.isPending ? 'Đang gửi…' : 'Gửi'}
        </Button>
      </div>
    </div>
  );
}
