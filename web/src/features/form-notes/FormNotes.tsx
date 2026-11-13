/* Ghi chú nội bộ trên lá đơn (chỉ cán bộ có quyền internalNotes; người nộp đơn không thấy).
   Nút tròn ở góc phải dưới, có số ghi chú; bấm thì mở khung nhỏ kiểu Notion: chuỗi ghi chú cũ trước mới sau, ô soạn ở đáy.
   Khung kéo góc trên bên trái để co giãn; cỡ khung nhớ trong trình duyệt. Ghi chú của mình thì sửa, xóa được. */
import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type RefObject } from 'react';
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
import { NoteIcon } from './NoteIcon';
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

/** Thuộc tính đánh dấu thanh nằm ở đáy màn hình mà nút tròn không được che (vd hàng nút Duyệt / Lưu thay đổi dính đáy). */
export const AVOID_NOTES_BUTTON_ATTRIBUTE = 'data-avoid-notes-button';

/** Khoảng cách giữa nút tròn và thanh nằm dưới nó (px). */
const FAB_GAP = 12;

/**
 * Chỗ đứng của nút tròn tính từ đáy màn hình. Bình thường ở góc phải dưới; thanh có AVOID_NOTES_BUTTON_ATTRIBUTE
 * mà nằm đúng chỗ đó (màn hình hẹp, thanh kéo dài tới mép phải) thì nút nâng lên đứng trên thanh.
 * Tính lại khi cuộn, đổi cỡ màn hình, hoặc trang đổi (thanh hiện / ẩn, khung Thông tin đơn mở / đóng).
 * @param buttonRef  nút tròn
 * @returns          khoảng cách tới đáy màn hình (px); chưa tính xong thì null (dùng chỗ mặc định của CSS)
 */
function useFabBottom(buttonRef: RefObject<HTMLButtonElement | null>): number | null {
  const [fabBottom, setFabBottom] = useState<number | null>(null);

  useEffect(() => {
    let frame = 0;

    /** Tính lại chỗ đứng, gộp nhiều lần gọi trong cùng một khung hình. */
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const button = buttonRef.current;
        if (!button) return;

        // Chỗ mặc định ở góc phải dưới (màn hình hẹp sát góc hơn, như CSS)
        const baseBottom = window.matchMedia('(max-width:560px)').matches ? 16 : 24;
        const { left, right } = button.getBoundingClientRect();
        const defaultTop = window.innerHeight - baseBottom - button.offsetHeight;

        // Thanh nào chồng lên chỗ mặc định thì đứng trên thanh đó
        let nextBottom = baseBottom;
        document.querySelectorAll<HTMLElement>(`[${AVOID_NOTES_BUTTON_ATTRIBUTE}]`).forEach((bar) => {
          const rect = bar.getBoundingClientRect();
          const overlapsAcross = rect.left < right + FAB_GAP && rect.right > left - FAB_GAP;
          const overlapsDown = rect.top < window.innerHeight - baseBottom && rect.bottom > defaultTop - FAB_GAP;
          if (overlapsAcross && overlapsDown) nextBottom = Math.max(nextBottom, window.innerHeight - rect.top + FAB_GAP);
        });
        setFabBottom(nextBottom);
      });
    };

    // Tính ngay, rồi theo dõi cuộn, đổi cỡ, trang đổi
    update();
    window.addEventListener('scroll', update, { passive: true, capture: true });
    window.addEventListener('resize', update);
    const pageObserver = new MutationObserver(update);
    pageObserver.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', update, { capture: true });
      window.removeEventListener('resize', update);
      pageObserver.disconnect();
    };
  }, [buttonRef]);

  return fabBottom;
}

/**
 * Chỗ nhớ các ghi chú đã xem trong trình duyệt: mỗi người, mỗi lá đơn một mục (cùng trình duyệt có thể đăng nhập nhiều người).
 * @param userId  id người đang đăng nhập
 * @param code    mã đơn
 * @returns       vd 'form-notes-seen:cb-1:XMM-2026-001-00001'
 */
const seenNotesStorageKey = (userId: string, code: string) => `form-notes-seen:${userId}:${code}`;

/**
 * Đọc các ghi chú một người đã xem trên một lá đơn.
 * @param storageKey  chỗ nhớ, từ seenNotesStorageKey
 * @returns           id các ghi chú đã xem; chưa mở khung lần nào, hoặc trình duyệt chặn bộ nhớ, thì rỗng
 */
function readSeenNoteIds(storageKey: string): Set<string> {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(storageKey) ?? '[]');
    if (Array.isArray(saved)) return new Set(saved.filter((noteId): noteId is string => typeof noteId === 'string'));
  } catch {
    // Bộ nhớ bị chặn hoặc dữ liệu hỏng: coi như chưa xem ghi chú nào
  }
  return new Set();
}

/**
 * Số ghi chú người khác viết mà mình chưa xem. Mở khung ghi chú là xem hết các ghi chú đang có (nhớ trong trình duyệt).
 * @param code       mã đơn
 * @param notes      các ghi chú đã tải (undefined: chưa tải xong)
 * @param panelOpen  true: đang mở khung ghi chú
 * @returns          số ghi chú chưa xem; ghi chú của mình không tính
 */
function useUnseenNoteCount(code: string, notes: FormNote[] | undefined, panelOpen: boolean): number {
  const { user } = useAuth();
  const storageKey = seenNotesStorageKey(user?.id ?? '', code);
  const [seen, setSeen] = useState(() => ({ storageKey, noteIds: readSeenNoteIds(storageKey) }));

  // Đổi người đăng nhập (vd đổi vai trò khi dev) hoặc đổi lá đơn: đọc lại danh sách đã xem của người đó, lá đơn đó
  const seenNoteIds = seen.storageKey === storageKey ? seen.noteIds : readSeenNoteIds(storageKey);
  if (seen.storageKey !== storageKey) setSeen({ storageKey, noteIds: seenNoteIds });

  // Đang mở khung: các ghi chú đang có coi như đã xem (chỉ giữ id còn tồn tại, ghi chú đã xóa thì bỏ)
  useEffect(() => {
    if (!panelOpen || !notes || notes.every((note) => seenNoteIds.has(note.id))) return;
    const currentNoteIds = notes.map((note) => note.id);
    try {
      localStorage.setItem(storageKey, JSON.stringify(currentNoteIds));
    } catch {
      // Bộ nhớ bị chặn: chỉ nhớ đến khi rời trang
    }
    setSeen({ storageKey, noteIds: new Set(currentNoteIds) });
  }, [storageKey, notes, panelOpen, seenNoteIds]);

  return notes?.filter((note) => note.author.id !== user?.id && !seenNoteIds.has(note.id)).length ?? 0;
}

/**
 * Nút tròn và khung ghi chú nội bộ của một lá đơn. Chỉ đặt vào trang khi người xem có quyền internalNotes.
 * @param code         mã đơn
 * @param initialOpen  true: mở sẵn khung (vd bấm ô Ghi chú ở bảng đơn)
 * @returns            nút tròn cố định ở góc phải dưới, và khung ghi chú khi đang mở
 */
export function FormNotes({ code, initialOpen = false }: { code: string; initialOpen?: boolean }) {
  const [open, setOpen] = useState(initialOpen);
  const notesQuery = useFormNotes(code, open);
  const { size, handleProps } = usePanelResize();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const noteCount = notesQuery.data?.length ?? 0;
  const unseenNoteCount = useUnseenNoteCount(code, notesQuery.data, open);
  const fabBottom = useFabBottom(buttonRef);
  // Khung đứng ngay trên nút tròn, nút nâng lên thì khung nâng theo
  const fabBottomStyle = fabBottom === null ? undefined : ({ '--fab-bottom': `${fabBottom}px` } as CSSProperties);

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
          style={{ '--panel-width': `${size.width}px`, '--panel-height': `${size.height}px`, ...fabBottomStyle } as CSSProperties}
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
        style={fabBottomStyle}
        onClick={() => (open ? closePanel() : setOpen(true))}
        aria-expanded={open}
        aria-label={`Ghi chú nội bộ${noteCount ? ` (${noteCount}${unseenNoteCount ? `, ${unseenNoteCount} chưa xem` : ''})` : ''}`}
        title={unseenNoteCount ? `Ghi chú nội bộ: ${unseenNoteCount} ghi chú chưa xem` : 'Ghi chú nội bộ'}
      >
        <NoteIcon />
        {/* Số ghi chú; có ghi chú người khác viết mà mình chưa xem thì số màu đỏ */}
        {noteCount > 0 && <span className={`${styles.badge} ${unseenNoteCount ? styles.badgeUnseen : ''}`}>{noteCount}</span>}
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
