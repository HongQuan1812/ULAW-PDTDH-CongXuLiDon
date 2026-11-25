/* Khung nổi "Mẫu xuất đơn" (Word) và "Mẫu xuất danh sách đơn" (Excel) trong trình soạn loại đơn: cùng một khung, khác mục đích;
   mở từ nút tròn ở cạnh phải màn hình (ExportTemplatesDock.tsx).
   Mẫu thuộc loại đơn (dùng chung mọi phiên bản). Chọn file (bấm hoặc kéo thả, như câu hỏi tải tệp của lá đơn), đổi tên, xóa
   chỉ ghi nhận trong trình duyệt và trình soạn hiện "Chưa lưu"; bấm Lưu mới gửi lên máy chủ (exportTemplateChanges.ts).
   Mã trong mỗi mẫu tự được kiểm tra (không cần bấm nút), theo bản soạn đang hiện
   (kể cả thay đổi chưa lưu, kể cả mẫu chưa lưu). Muốn xem mẫu điền dữ liệu thật: mẫu đơn thì Xuất đơn ở trang chi tiết
   một lá đơn; mẫu danh sách đơn thì Xuất danh sách đơn ở đầu trình soạn loại đơn.
   Mỗi lần mở khung, các mục thu gọn bên trong đều đóng. Bấm Esc thì đóng khung. */
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import {
  EXPORT_MESSAGES,
  EXPORT_TEMPLATE_FILE,
  TEMPLATE_FILE_MESSAGES,
  formatFileSize,
  hasTemplateExtension,
  questionExportTags,
  type ExportDraftRequest,
  type ExportTemplatePurpose,
} from '@ulaw/shared';
import {
  checkExportTemplate,
  checkExportTemplateFile,
  fetchExportTemplateFile,
  useExportTemplates,
} from '../../api/exports';
import { FileDropZone } from '../../components/FileDropZone';
import { LoadError, loadErrorMessage } from '../../components/LoadError';
import { RefreshButton } from '../../components/RefreshButton';
import { useToast } from '../../components/Toast';
import { FilePreview, type PreviewFile } from '../../features/file-preview/FilePreview';
import { saveToDevice } from '../../lib/saveToDevice';
import { useCloseOnEscape } from '../../lib/useCloseOnEscape';
import { checkFailureOf, checkResultOf, type TemplateResult } from '../../features/export/checkResult';
import { EditorIconButton } from './EditorIconButton';
import { ExportHowTo, ExportTagGuide } from './ExportTagGuide';
import { removeRow, renameRow, stageTemplate, templateRows, type ExportTemplateChanges, type TemplateRow } from './exportTemplateChanges';
import { CloseIcon } from '../../components/CloseIcon';
import styles from './ExportTemplatesPanel.module.css';

/** Chờ người dùng ngừng gõ bao lâu (ms) rồi mới kiểm tra lại mã các mẫu theo bản soạn mới. */
const CHECK_REFRESH_DELAY_MS = 800;

/** Chữ trên khung theo mục đích: tiêu đề, lời giới thiệu, gợi ý ở ô chọn file. */
export const PANEL_TEXT: Record<ExportTemplatePurpose, { title: string; intro: string; dropHint: string }> = {
  form: {
    title: 'Mẫu xuất đơn',
    intro: 'File Word có chèn mã. Khi bấm “Xuất đơn” ở chi tiết đơn, các mã được thay bằng dữ liệu của đơn.',
    dropHint: 'Chỉ nhận file Word .docx — bấm Lưu để tải lên',
  },
  list: {
    title: 'Mẫu xuất danh sách đơn',
    intro: 'File Excel có một hàng mẫu chứa mã. Khi xuất, hàng mẫu nhân lên thành mỗi đơn một hàng.',
    dropHint: 'Chỉ nhận file Excel .xlsx — bấm Lưu để tải lên',
  },
};

export interface ExportTemplatesPanelProps {
  /** Khung mẫu xuất đơn (Word) hay danh sách đơn (Excel) */
  purpose: ExportTemplatePurpose;
  /** Mã loại đơn; null = loại đơn mới chưa lưu (chưa có mẫu nào ở máy chủ) */
  formTypeId: string | null;
  /** Bản soạn đang hiện: tên, mã đơn, các phần */
  draft: ExportDraftRequest;
  /** Số phiên bản đang xem (bản soạn ở trên là của phiên bản này) */
  version: number;
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
 * Khung nổi Mẫu xuất đơn / Mẫu xuất danh sách đơn (mở từ nút tròn ở cạnh phải, xem ExportTemplatesDock.tsx).
 * @param props  xem ExportTemplatesPanelProps; onClose: bấm nút đóng
 * @returns      khung nổi: đầu khung (tên, lời giới thiệu, nút đóng) và phần cuộn được (Cách tạo một mẫu, các mẫu, Bảng mã)
 */
export function ExportTemplatesPanel({
  purpose,
  formTypeId,
  draft,
  version,
  changes,
  onChangesChange,
  saving,
  onClose,
}: ExportTemplatesPanelProps & { onClose: () => void }) {
  const text = PANEL_TEXT[purpose];
  const titleId = useId();
  const questionTags = useMemo(() => questionExportTags(draft.sections), [draft.sections]);

  // Bản soạn dùng để kiểm tra mã: chờ ngừng gõ rồi mới lấy bản mới
  const settledDraft = useSettledValue(draft, CHECK_REFRESH_DELAY_MS);

  // Danh sách mẫu ở máy chủ (loại đơn đã lưu); lượt kiểm tra mã, tăng lên thì mọi mẫu kiểm tra lại
  const templatesQuery = useExportTemplates(formTypeId ?? '', formTypeId !== null);
  const [checkRound, setCheckRound] = useState(0);

  /** Nút ↻ cạnh chữ "Các mẫu": ngoài tải lại danh sách mẫu, còn kiểm tra lại mã mọi mẫu. */
  const refreshAll = () => setCheckRound((round) => round + 1);

  // Bấm Esc thì đóng khung, như các hộp thoại khác; đang mở hộp thoại con (xem tệp…) thì Esc chỉ đóng hộp thoại đó
  useCloseOnEscape(true, onClose);

  return (
    <section className={styles.popup} role="dialog" aria-labelledby={titleId}>
      {/* Đầu khung: tên, lời giới thiệu, nút đóng */}
      <header className={styles.popupHead}>
        <div>
          <h2 id={titleId}>{text.title}</h2>
          <p className={styles.intro}>{text.intro}</p>
        </div>
        <button type="button" className={styles.closeButton} onClick={onClose} aria-label={`Đóng ${text.title}`} title="Đóng">
          <CloseIcon size={18} />
        </button>
      </header>

      {/* Phần cuộn được */}
      <div className={styles.popupBody}>
        <TemplateList
          purpose={purpose}
          formTypeId={formTypeId}
          templatesQuery={templatesQuery}
          checkRound={checkRound}
          onRefresh={refreshAll}
          checkDraft={settledDraft}
          changes={changes}
          onChangesChange={onChangesChange}
          saving={saving}
          version={version}
          howTo={<ExportHowTo purpose={purpose} sections={draft.sections} formTypeName={draft.name} version={version} />}
        />
        <ExportTagGuide purpose={purpose} questionTags={questionTags} version={version} />
      </div>
    </section>
  );
}

/**
 * Mục "Các mẫu": Cách tạo một mẫu, khung chọn file, danh sách mẫu (đã lưu và chưa lưu), mỗi mẫu có Xem, Tải về, Đổi tên, Xóa.
 * Thêm, đổi tên, xóa chỉ ghi nhận (lưu khi bấm Lưu của trình soạn); Xem chạy ngay, mẫu chưa lưu thì mở thẳng file trong trình duyệt.
 * Mã trong mỗi mẫu tự được kiểm tra khi mẫu vừa thêm / vừa mở khung, và mỗi khi câu hỏi đổi (sau lúc ngừng gõ);
 * hiện kết quả ngay dưới mẫu: đỏ khi có vấn đề, xanh khi mọi mã đều khớp với phiên bản đang xem.
 * @param props  xem ExportTemplatesPanelProps; templatesQuery: danh sách mẫu ở máy chủ;
 *               checkRound: lượt kiểm tra (nút ↻ tăng lên thì kiểm tra lại mọi mẫu); onRefresh: bấm nút ↻; checkDraft: bản soạn đã ngừng gõ, dùng để kiểm tra mã
 * @returns      mục các mẫu, và trình xem mẫu gốc
 */
function TemplateList({
  purpose,
  formTypeId,
  templatesQuery,
  checkRound,
  onRefresh,
  checkDraft,
  changes,
  onChangesChange,
  saving,
  version,
  howTo,
}: Omit<ExportTemplatesPanelProps, 'draft'> & {
  /** Mục "Cách tạo một mẫu", đặt trên khung chọn file */
  howTo: ReactNode;
  templatesQuery: ReturnType<typeof useExportTemplates>;
  checkRound: number;
  /** Bấm nút ↻ */
  onRefresh: () => void;
  checkDraft: ExportDraftRequest;
}) {
  const toast = useToast();
  const [checkResults, setCheckResults] = useState<Record<string, TemplateResult>>({});
  const [busyRowId, setBusyRowId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [previewedFile, setPreviewedFile] = useState<PreviewFile | null>(null);
  // Bản soạn đã dùng để kiểm tra mã mỗi mẫu, để không kiểm tra lại khi chưa có gì đổi; lượt kiểm tra đã chạy
  const checkedDrafts = useRef(new Map<string, ExportDraftRequest>());
  const lastCheckRound = useRef(checkRound);
  const savedTemplates = templatesQuery.data;
  const rows = useMemo(() => templateRows(savedTemplates ?? [], changes, purpose), [savedTemplates, changes, purpose]);
  const listLoading = formTypeId !== null && templatesQuery.isPending;

  // Danh sách mẫu đã tải lên thu gọn sẵn cho đỡ rối; tự mở khi người dùng vừa thêm file mới
  const [listOpen, setListOpen] = useState(false);
  const stagedCount = rows.filter((row) => row.kind === 'staged').length;
  const previousStagedCount = useRef(stagedCount);
  useEffect(() => {
    if (stagedCount > previousStagedCount.current) setListOpen(true);
    previousStagedCount.current = stagedCount;
  }, [stagedCount]);

  // Số mẫu có mã không khớp, báo ngay trên dòng thu gọn
  const badCount = rows.filter((row) => checkResults[row.id]?.tone === 'bad').length;
  const fileInfo = EXPORT_TEMPLATE_FILE[purpose];
  // Mẫu đã lưu cùng mục đích đang chờ xóa (hai khung dùng chung một bộ thay đổi)
  const removedIds = changes.removed.filter((templateId) => savedTemplates?.some((template) => template.id === templateId && template.purpose === purpose));

  // Tự kiểm tra mã: mẫu chưa kiểm tra theo bản soạn hiện tại thì kiểm tra; chỉ giữ cảnh báo của lần kiểm tra mới nhất.
  // Bấm ↻ (lượt kiểm tra mới) thì quên các lần trước, kiểm tra lại mọi mẫu
  useEffect(() => {
    if (lastCheckRound.current !== checkRound) {
      lastCheckRound.current = checkRound;
      checkedDrafts.current.clear();
    }
    rows.forEach((row) => {
      if (checkedDrafts.current.get(row.id) === checkDraft) return;
      checkedDrafts.current.set(row.id, checkDraft);
      const checking =
        row.kind === 'saved'
          ? checkExportTemplate(formTypeId!, row.id, checkDraft)
          : checkExportTemplateFile(row.staged.file, checkDraft);
      void checking
        .then((check): TemplateResult => checkResultOf(check, 'phiên bản này'))
        .catch((error: unknown): TemplateResult => checkFailureOf(error))
        .then((result) => {
          if (checkedDrafts.current.get(row.id) !== checkDraft) return;
          setCheckResults((current) => ({ ...current, [row.id]: result }));
        });
    });
  }, [rows, checkDraft, formTypeId, checkRound]);

  /**
   * Thêm các file vừa chọn / kéo thả làm mẫu mới (chưa lưu): bỏ file sai loại (khung mẫu đơn nhận .docx, khung danh sách đơn nhận .xlsx)
   * và file trùng tên với mẫu cùng khung đang chờ lưu (báo lí do bằng toast).
   * @param chosenFiles  file từ hộp chọn file hoặc kéo thả
   */
  const addFiles = (chosenFiles: FileList) => {
    const messages: string[] = [];
    const added = [...changes.added];
    Array.from(chosenFiles).forEach((file) => {
      if (!hasTemplateExtension(file.name, purpose)) messages.push(`${file.name}: ${TEMPLATE_FILE_MESSAGES[purpose].wrongType}`);
      else if (added.some((staged) => staged.purpose === purpose && staged.file.name === file.name)) messages.push(EXPORT_MESSAGES.duplicateFile(file.name));
      else added.push(stageTemplate(file, purpose));
    });
    messages.forEach((message) => toast(message, 'error'));
    if (added.length > changes.added.length) onChangesChange({ ...changes, added });
  };

  /**
   * Lấy file mẫu gốc (còn nguyên các mã) rồi làm một việc với nó. Mẫu chưa lưu thì dùng thẳng file trong trình duyệt;
   * mẫu đã lưu thì tải từ máy chủ (khóa nút của dòng trong lúc tải, lỗi thì báo bằng toast).
   * @param row      dòng mẫu
   * @param useFile  việc làm với file: nhận tên file, nội dung
   */
  const withTemplateFile = async (row: TemplateRow, useFile: (fileName: string, content: Blob) => void) => {
    if (row.kind === 'staged') {
      useFile(row.staged.file.name, row.staged.file);
      return;
    }
    setBusyRowId(row.id);
    try {
      const templateFile = await fetchExportTemplateFile(formTypeId!, row.id);
      useFile(row.template.fileName, templateFile.content);
    } catch (error) {
      toast(error instanceof Error ? error.message : EXPORT_MESSAGES.templateNotFound, 'error');
    } finally {
      setBusyRowId(null);
    }
  };

  /**
   * Xem mẫu gốc, có nút "Tải mẫu gốc" trên thanh xem.
   * @param row  dòng mẫu
   */
  const viewTemplate = (row: TemplateRow) =>
    withTemplateFile(row, (fileName, content) =>
      setPreviewedFile({
        id: `template-${row.id}-${Date.now()}`,
        name: fileName,
        sizeBytes: content.size,
        content,
        title: row.name,
        note: row.kind === 'staged' ? 'Mẫu gốc · chưa lưu' : 'Mẫu gốc',
        downloadLabel: 'Tải mẫu gốc',
      }),
    );

  /**
   * Tải mẫu gốc về máy, không cần mở xem.
   * @param row  dòng mẫu
   */
  const downloadTemplate = (row: TemplateRow) => withTemplateFile(row, (fileName, content) => saveToDevice(content, fileName));

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
      </div>

      {/* Cách tạo một mẫu: ngay trên khung chọn file, đọc xong là chọn file luôn */}
      {howTo}

      {/* Chọn file: bấm hoặc kéo thả, như câu hỏi tải tệp của lá đơn; bấm Lưu mới tải lên */}
      {!saving && (
        <FileDropZone
          accept={`${fileInfo.extension},${fileInfo.contentType}`}
          hint={
            <>
              {PANEL_TEXT[purpose].dropHint}
              <br />
              Mã trong file được kiểm theo <b className={styles.versionEmphasis}>Phiên bản {version}</b>
            </>
          }
          onFiles={addFiles}
        />
      )}

      {listLoading ? (
        <p className={styles.empty}>Đang tải danh sách mẫu…</p>
      ) : templatesQuery.isError ? (
        <LoadError message={loadErrorMessage(templatesQuery) ?? EXPORT_MESSAGES.formTypeNotFound} />
      ) : rows.length ? (
        <details className={styles.guide} open={listOpen} onToggle={(event) => setListOpen(event.currentTarget.open)}>
          <summary>
            Mẫu đã tải lên
            <span className={styles.count}>{rows.length} mẫu</span>
            {/* chỉ báo khi có mẫu lệch mã, để khỏi mở ra mới biết; khớp hết thì không hiện gì */}
            {badCount > 0 && <span className={`${styles.summaryResult} ${styles.bad}`}>{badCount} mẫu có mã không khớp</span>}
            {badCount === 0 && rows.length > 0 && rows.every((row) => checkResults[row.id]) && (
              <span className={`${styles.summaryResult} ${styles.good}`}>Tất cả mẫu đều khớp mã</span>
            )}
          </summary>
          <div className={`${styles.list} ${styles.guideBody}`}>
            {rows.map((row) => {
              const busy = busyRowId === row.id;
              const fileName = row.kind === 'staged' ? row.staged.file.name : row.template.fileName;
              const sizeBytes = row.kind === 'staged' ? row.staged.file.size : row.template.sizeBytes;
              return (
                <div key={row.id} className={styles.template}>
                  <span className={styles.fileType}>{fileInfo.typeLabel}</span>
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
                    <EditorIconButton icon="view" label="Xem mẫu" disabled={busy} onClick={() => void viewTemplate(row)} />
                    <EditorIconButton icon="download" label="Tải mẫu gốc về máy" disabled={busy} onClick={() => void downloadTemplate(row)} />
                    <EditorIconButton
                      icon="rename"
                      label={`Đổi tên: ${purpose === 'form' ? 'tên này hiện khi chọn mẫu lúc Xuất đơn' : 'tên này cũng là phần sau của tên file xuất ra'}`}
                      disabled={busy || saving}
                      onClick={() => setRenamingId(row.id)}
                    />
                    <EditorIconButton
                      icon="delete"
                      label={row.kind === 'staged' ? 'Gỡ mẫu chưa lưu' : 'Xóa mẫu'}
                      disabled={busy || saving}
                      onClick={() => onChangesChange(removeRow(changes, row))}
                    />
                  </div>
                  {/* kết quả của lần tự kiểm tra mã: đỏ khi có vấn đề, xanh khi khớp hết */}
                  {checkResults[row.id] && (
                    <p className={`${styles.result} ${checkResults[row.id]!.tone === 'bad' ? styles.bad : styles.good}`} role="status">
                      {checkResults[row.id]!.text}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </details>
      ) : null}

      {/* Mẫu đã lưu vừa bấm xóa: chỉ xóa thật khi bấm Lưu; Hoàn tác để giữ lại */}
      {removedIds.length > 0 && (
        <p className={styles.removedNote}>
          Sẽ xóa {removedIds.length} mẫu khi bấm Lưu.{' '}
          {!saving && (
            <button
              type="button"
              className={styles.undo}
              onClick={() => onChangesChange({ ...changes, removed: changes.removed.filter((templateId) => !removedIds.includes(templateId)) })}
            >
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
