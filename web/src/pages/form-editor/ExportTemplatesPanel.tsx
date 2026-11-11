/* Khung "Mẫu xuất file" trong trình soạn loại đơn (như tplCardHtml() và các nút data-act="tpl…" của artifact/js/print-templates.js).
   Mẫu thuộc loại đơn (dùng chung mọi phiên bản). Chọn file (bấm hoặc kéo thả, như câu hỏi tải tệp của lá đơn), đổi tên, xóa
   chỉ ghi nhận trong trình duyệt và trình soạn hiện "Chưa lưu"; bấm Lưu mới gửi lên máy chủ (exportTemplateChanges.ts).
   Mã trong mỗi mẫu tự được kiểm tra (không cần bấm nút), theo bản soạn đang hiện
   (kể cả thay đổi chưa lưu, kể cả mẫu chưa lưu). Muốn xem mẫu điền dữ liệu thật thì Xuất file ở trang chi tiết một lá đơn.
   Mỗi lần mở trình soạn, khung và các mục thu gọn bên trong đều đóng. */
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import {
  DOCX_CONTENT_TYPE,
  EXPORT_MESSAGES,
  formatFileSize,
  questionExportTags,
  type ExportDraftRequest,
  type ExportTemplateCheck,
} from '@ulaw/shared';
import {
  checkExportTemplate,
  checkExportTemplateFile,
  fetchExportTemplateFile,
  useExportTemplates,
} from '../../api/exports';
import { Button } from '../../components/Button';
import { FileDropZone } from '../../components/FileDropZone';
import { LoadError, loadErrorMessage } from '../../components/LoadError';
import { RefreshButton } from '../../components/RefreshButton';
import { useToast } from '../../components/Toast';
import { FilePreview, type PreviewFile } from '../../features/file-preview/FilePreview';
import { EditorIconButton } from './EditorIconButton';
import { ExportTagGuide } from './ExportTagGuide';
import { removeRow, renameRow, stageTemplate, templateRows, type ExportTemplateChanges, type TemplateRow } from './exportTemplateChanges';
import styles from './ExportTemplatesPanel.module.css';

/** Chờ người dùng ngừng gõ bao lâu (ms) rồi mới kiểm tra lại mã các mẫu theo bản soạn mới. */
const CHECK_REFRESH_DELAY_MS = 800;

/** Hộp chọn file chỉ hiện file Word .docx. */
const DOCX_ACCEPT = `.docx,${DOCX_CONTENT_TYPE}`;

/** Kết quả kiểm tra mã một mẫu. */
interface TemplateResult {
  tone: 'good' | 'bad';
  text: string;
}

interface ExportTemplatesPanelProps {
  /** Mã loại đơn; null = loại đơn mới chưa lưu (chưa có mẫu nào ở máy chủ) */
  formTypeId: string | null;
  /** Bản soạn đang hiện: tên, mã đơn, các phần */
  draft: ExportDraftRequest;
  /** Các thay đổi chưa lưu về mẫu */
  changes: ExportTemplateChanges;
  /** Gọi với các thay đổi mới (thêm, đổi tên, xóa mẫu) */
  onChangesChange: (nextChanges: ExportTemplateChanges) => void;
  /** Đang lưu: không cho thay đổi mẫu */
  saving: boolean;
}

/**
 * Giá trị theo sau một khoảng chờ: đổi liên tục (đang gõ) thì chỉ lấy giá trị cuối.
 * @param value    giá trị mới nhất
 * @param delayMs  thời gian chờ
 * @returns        giá trị đã ổn định
 */
function useSettledValue<Value>(value: Value, delayMs: number): Value {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return settled;
}

/**
 * Câu kết quả của Kiểm tra mã (như nhánh tplCheck của bản mẫu).
 * @param check      kết quả từ máy chủ
 * @param tableTags  mã các câu hỏi dạng bảng, để chỉ chỗ đặt mã cột
 * @returns          câu báo và sắc thái (tốt / có vấn đề)
 */
function checkResultOf(check: ExportTemplateCheck, tableTags: string[]): TemplateResult {
  const codes = (tags: string[]) => tags.map((tag) => `{${tag}}`).join(' ');
  if (check.error) return { tone: 'bad', text: `Mẫu có lỗi: ${check.error}` };
  if (!check.found.length) return { tone: 'bad', text: 'Không thấy mã trường nào trong mẫu. Gõ mã trong ngoặc nhọn, vd {ho_ten}.' };
  const problems: string[] = [];
  if (check.unknown.length) {
    problems.push(`Có ${check.unknown.length} mã không có trong loại đơn này: ${codes(check.unknown)} — sẽ để trống khi xuất file.`);
  }
  if (check.outside.length) {
    const loops = tableTags.map((tag) => `{#${tag}} … {/${tag}}`).join(' hoặc ');
    problems.push(`Mã cột ${codes(check.outside)} nằm ngoài vòng lặp — sẽ để trống. Đặt chúng giữa ${loops}.`);
  }
  if (problems.length) return { tone: 'bad', text: problems.join('\n') };
  return { tone: 'good', text: `Mẫu hợp lệ: ${check.found.length} mã trường đều dùng được.` };
}

/**
 * Khung Mẫu xuất file.
 * @param props  xem ExportTemplatesPanelProps
 * @returns      thẻ có nút thu gọn; mở ra thì có các mẫu, Cách tạo một mẫu, Bảng mã
 */
export function ExportTemplatesPanel({ formTypeId, draft, changes, onChangesChange, saving }: ExportTemplatesPanelProps) {
  const [open, setOpen] = useState(false);
  const bodyId = useId();
  const questionTags = useMemo(() => questionExportTags(draft.sections), [draft.sections]);

  // Bản soạn dùng để kiểm tra mã: chờ ngừng gõ rồi mới lấy bản mới
  const settledDraft = useSettledValue(draft, CHECK_REFRESH_DELAY_MS);

  // Danh sách mẫu ở máy chủ (loại đơn đã lưu); lượt kiểm tra mã, tăng lên thì mọi mẫu kiểm tra lại
  const templatesQuery = useExportTemplates(formTypeId ?? '', formTypeId !== null);
  const [checkRound, setCheckRound] = useState(0);
  const toggle = () => setOpen((isOpen) => !isOpen);

  /** Nút ↻ cạnh chữ "Các mẫu": ngoài tải lại danh sách mẫu, còn kiểm tra lại mã mọi mẫu. */
  const refreshAll = () => setCheckRound((round) => round + 1);

  return (
    <section className={styles.card} aria-labelledby={`${bodyId}-title`}>
      {/* Đầu khung: bấm cả hàng để thu / mở (nút mũi tên cho bàn phím) */}
      <div className={styles.cardHead} onClick={toggle}>
        <h2 id={`${bodyId}-title`}>Mẫu xuất file</h2>
        <button
          type="button"
          className={styles.toggle}
          aria-expanded={open}
          aria-controls={bodyId}
          aria-label={open ? 'Thu gọn Mẫu xuất file' : 'Mở Mẫu xuất file'}
          onClick={(event) => {
            event.stopPropagation();
            toggle();
          }}
        >
          <svg className={styles.chevron} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
      </div>
      <p className={styles.intro}>File Word có chèn mã. Khi bấm “Xuất file” ở chi tiết đơn, các mã được thay bằng dữ liệu của đơn.</p>

      {open && (
        <div id={bodyId} className={styles.body}>
          <TemplateList
            formTypeId={formTypeId}
            templatesQuery={templatesQuery}
            checkRound={checkRound}
            onRefresh={refreshAll}
            checkDraft={settledDraft}
            changes={changes}
            onChangesChange={onChangesChange}
            saving={saving}
          />
          <ExportTagGuide questionTags={questionTags} />
        </div>
      )}
    </section>
  );
}

/**
 * Mục "Các mẫu": khung chọn file Word, danh sách mẫu (đã lưu và chưa lưu), mỗi mẫu có Xem, Đổi tên, Xóa.
 * Thêm, đổi tên, xóa chỉ ghi nhận (lưu khi bấm Lưu của trình soạn); Xem chạy ngay, mẫu chưa lưu thì mở thẳng file trong trình duyệt.
 * Mã trong mỗi mẫu tự được kiểm tra khi mẫu vừa thêm / vừa mở khung, và mỗi khi câu hỏi đổi (sau lúc ngừng gõ);
 * có vấn đề thì hiện cảnh báo ngay dưới mẫu, hợp lệ thì không hiện gì.
 * @param props  xem ExportTemplatesPanelProps; templatesQuery: danh sách mẫu ở máy chủ;
 *               checkRound: lượt kiểm tra (nút ↻ tăng lên thì kiểm tra lại mọi mẫu); onRefresh: bấm nút ↻; checkDraft: bản soạn đã ngừng gõ, dùng để kiểm tra mã
 * @returns      mục các mẫu, và trình xem mẫu gốc
 */
function TemplateList({
  formTypeId,
  templatesQuery,
  checkRound,
  onRefresh,
  checkDraft,
  changes,
  onChangesChange,
  saving,
}: Omit<ExportTemplatesPanelProps, 'draft'> & {
  templatesQuery: ReturnType<typeof useExportTemplates>;
  checkRound: number;
  /** Bấm nút ↻ */
  onRefresh: () => void;
  checkDraft: ExportDraftRequest;
}) {
  const toast = useToast();
  const rejectedId = useId();
  const [warnings, setWarnings] = useState<Record<string, string>>({});
  const [busyRowId, setBusyRowId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [rejectedMessages, setRejectedMessages] = useState<string[]>([]);
  const [previewedFile, setPreviewedFile] = useState<PreviewFile | null>(null);
  // Bản soạn đã dùng để kiểm tra mã mỗi mẫu, để không kiểm tra lại khi chưa có gì đổi; lượt kiểm tra đã chạy
  const checkedDrafts = useRef(new Map<string, ExportDraftRequest>());
  const lastCheckRound = useRef(checkRound);
  const savedTemplates = templatesQuery.data;
  const rows = useMemo(() => templateRows(savedTemplates ?? [], changes), [savedTemplates, changes]);
  const listLoading = formTypeId !== null && templatesQuery.isPending;

  // Tự kiểm tra mã: mẫu chưa kiểm tra theo bản soạn hiện tại thì kiểm tra; chỉ giữ cảnh báo của lần kiểm tra mới nhất.
  // Bấm ↻ (lượt kiểm tra mới) thì quên các lần trước, kiểm tra lại mọi mẫu
  useEffect(() => {
    if (lastCheckRound.current !== checkRound) {
      lastCheckRound.current = checkRound;
      checkedDrafts.current.clear();
    }
    const tableTags = questionExportTags(checkDraft.sections)
      .filter((question) => question.columns)
      .map((question) => question.tag);
    rows.forEach((row) => {
      if (checkedDrafts.current.get(row.id) === checkDraft) return;
      checkedDrafts.current.set(row.id, checkDraft);
      const checking =
        row.kind === 'saved'
          ? checkExportTemplate(formTypeId!, row.id, checkDraft)
          : checkExportTemplateFile(row.staged.file, checkDraft);
      void checking
        .then((check): TemplateResult => checkResultOf(check, tableTags))
        .catch((error: unknown): TemplateResult => ({ tone: 'bad', text: error instanceof Error ? error.message : EXPORT_MESSAGES.unreadable }))
        .then((result) => {
          if (checkedDrafts.current.get(row.id) !== checkDraft) return;
          setWarnings((current) => ({ ...current, [row.id]: result.tone === 'bad' ? result.text : '' }));
        });
    });
  }, [rows, checkDraft, formTypeId, checkRound]);

  /**
   * Thêm các file vừa chọn / kéo thả làm mẫu mới (chưa lưu): bỏ file không phải .docx
   * và file trùng tên với mẫu đang chờ lưu (ghi lí do).
   * @param chosenFiles  file từ hộp chọn file hoặc kéo thả
   */
  const addFiles = (chosenFiles: FileList) => {
    const messages: string[] = [];
    const added = [...changes.added];
    Array.from(chosenFiles).forEach((file) => {
      if (!/\.docx$/i.test(file.name)) messages.push(`${file.name}: ${EXPORT_MESSAGES.notDocx}`);
      else if (added.some((staged) => staged.file.name === file.name)) messages.push(EXPORT_MESSAGES.duplicateFile(file.name));
      else added.push(stageTemplate(file));
    });
    setRejectedMessages(messages);
    if (added.length > changes.added.length) onChangesChange({ ...changes, added });
  };

  /**
   * Xem mẫu gốc (còn nguyên các mã), có nút "Tải mẫu gốc" trên thanh xem. Mẫu chưa lưu thì mở thẳng file trong trình duyệt.
   * @param row  dòng mẫu
   */
  const viewTemplate = async (row: TemplateRow) => {
    const showFile = (fileName: string, content: Blob, note: string) =>
      setPreviewedFile({
        id: `template-${row.id}-${Date.now()}`,
        name: fileName,
        sizeBytes: content.size,
        content,
        title: row.name,
        note,
        downloadLabel: 'Tải mẫu gốc',
      });
    if (row.kind === 'staged') {
      showFile(row.staged.file.name, row.staged.file, 'Mẫu gốc · chưa lưu');
      return;
    }
    setBusyRowId(row.id);
    try {
      const docx = await fetchExportTemplateFile(formTypeId!, row.id);
      showFile(row.template.fileName, docx.content, 'Mẫu gốc');
    } catch (error) {
      toast(error instanceof Error ? error.message : EXPORT_MESSAGES.templateNotFound, 'error');
    } finally {
      setBusyRowId(null);
    }
  };

  /**
   * Ghi nhận tên mới (đổi tên ngay tại dòng); tên trống hoặc không đổi thì thôi.
   * @param row   dòng mẫu
   * @param name  tên vừa gõ
   */
  const saveName = (row: TemplateRow, name: string) => {
    setRenamingId(null);
    const trimmed = name.trim();
    if (!trimmed || trimmed === row.name) return;
    onChangesChange(renameRow(changes, row, trimmed));
  };

  return (
    <div className={styles.block}>
      <div className={styles.blockHead}>
        <h3>Các mẫu</h3>
        {formTypeId !== null && <RefreshButton query={templatesQuery} label="các mẫu xuất file" size="small" onRefresh={onRefresh} />}
        {!listLoading && <span className={styles.count}>{rows.length} mẫu</span>}
      </div>

      {/* Chọn file Word: bấm hoặc kéo thả, như câu hỏi tải tệp của lá đơn; bấm Lưu mới tải lên */}
      {!saving && (
        <FileDropZone
          accept={DOCX_ACCEPT}
          hint="Chỉ nhận file Word .docx — bấm Lưu để tải lên"
          describedBy={rejectedMessages.length ? rejectedId : undefined}
          onFiles={addFiles}
        />
      )}
      {rejectedMessages.length > 0 && (
        <p id={rejectedId} className={styles.rejected} role="alert">
          {rejectedMessages.map((message) => (
            <span key={message}>{message}</span>
          ))}
        </p>
      )}

      {listLoading ? (
        <p className={styles.empty}>Đang tải danh sách mẫu…</p>
      ) : templatesQuery.isError ? (
        <LoadError message={loadErrorMessage(templatesQuery) ?? EXPORT_MESSAGES.formTypeNotFound} />
      ) : rows.length ? (
        <div className={styles.list}>
          {rows.map((row) => {
            const busy = busyRowId === row.id;
            const fileName = row.kind === 'staged' ? row.staged.file.name : row.template.fileName;
            const sizeBytes = row.kind === 'staged' ? row.staged.file.size : row.template.sizeBytes;
            return (
              <div key={row.id} className={styles.template}>
                <span className={styles.fileType}>DOCX</span>
                {renamingId === row.id ? (
                  <RenameInput name={row.name} onDone={(name) => saveName(row, name)} onCancel={() => setRenamingId(null)} />
                ) : (
                  <button type="button" className={styles.templateName} title="Xem mẫu" disabled={busy} onClick={() => void viewTemplate(row)}>
                    <b>{row.name}</b>
                    <span>
                      {fileName} · {formatFileSize(sizeBytes)}
                      {row.kind === 'saved' && ` · ${row.template.uploadedBy}`}
                    </span>
                  </button>
                )}
                <div className={styles.actions}>
                  <Button className={styles.smallButton} disabled={busy} onClick={() => void viewTemplate(row)}>
                    Xem
                  </Button>
                  <Button
                    className={styles.smallButton}
                    disabled={busy || saving}
                    title="Tên này hiện khi chọn mẫu lúc Xuất file"
                    onClick={() => setRenamingId(row.id)}
                  >
                    Đổi tên
                  </Button>
                  <EditorIconButton
                    icon="delete"
                    label={row.kind === 'staged' ? 'Gỡ mẫu chưa lưu' : 'Xóa mẫu'}
                    disabled={busy || saving}
                    onClick={() => onChangesChange(removeRow(changes, row))}
                  />
                </div>
                {/* cảnh báo của lần tự kiểm tra mã; mẫu hợp lệ thì không hiện */}
                {warnings[row.id] && (
                  <p className={`${styles.result} ${styles.bad}`} role="status">
                    {warnings[row.id]}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      ) : null}

      {/* Mẫu đã lưu vừa bấm xóa: chỉ xóa thật khi bấm Lưu; Hoàn tác để giữ lại */}
      {changes.removed.length > 0 && (
        <p className={styles.removedNote}>
          Sẽ xóa {changes.removed.length} mẫu khi bấm Lưu.{' '}
          {!saving && (
            <button type="button" className={styles.undo} onClick={() => onChangesChange({ ...changes, removed: [] })}>
              Hoàn tác
            </button>
          )}
        </p>
      )}

      <FilePreview file={previewedFile} onClose={() => setPreviewedFile(null)} />
    </div>
  );
}

/**
 * Ô đổi tên mẫu ngay tại dòng: Enter hoặc bấm ra ngoài để ghi nhận, Esc để hủy.
 * @param name      tên đang hiện của mẫu
 * @param onDone    gọi với tên vừa gõ
 * @param onCancel  hủy đổi tên
 * @returns         ô nhập
 */
function RenameInput({ name: currentName, onDone, onCancel }: { name: string; onDone: (name: string) => void; onCancel: () => void }) {
  const [name, setName] = useState(currentName);
  const [finished, setFinished] = useState(false);

  /**
   * Kết thúc đổi tên một lần (Enter rồi mất con trỏ không ghi nhận hai lần).
   * @param save  true: ghi nhận · false: hủy
   */
  const finish = (save: boolean) => {
    if (finished) return;
    setFinished(true);
    if (save) onDone(name);
    else onCancel();
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      finish(true);
    } else if (event.key === 'Escape') {
      event.stopPropagation();
      finish(false);
    }
  };

  return (
    <input
      className={styles.renameInput}
      value={name}
      aria-label="Tên mẫu"
      autoFocus
      onFocus={(event) => event.target.select()}
      onChange={(event) => setName(event.target.value)}
      onKeyDown={onKeyDown}
      onBlur={() => finish(true)}
    />
  );
}
