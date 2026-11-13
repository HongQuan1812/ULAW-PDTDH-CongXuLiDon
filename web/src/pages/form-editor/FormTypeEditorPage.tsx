/* Trình soạn loại đơn (#/soan-don/<mã loại đơn>[?phien-ban=<số>], tạo mới: #/soan-don/moi).
   Gồm: nút quay lại, tiêu đề, nút Xuất thống kê, tab Soạn / Xem trước, khung Phiên bản bên phải (màn hình hẹp: trượt ra), nhãn "Chưa lưu", khung báo lỗi, câu nhắc về phiên bản,
   thẻ Thông tin loại đơn, các phần và câu hỏi, nút + Thêm phần, hàng nút cuối (Xóa · Bỏ thay đổi · Lưu; hai nút cuối chỉ hiện khi có thay đổi).

   Phiên bản (xem shared/src/api-contract/form-types.ts):
   - Phiên bản Nháp sửa được; Lưu ở Nháp để soạn tiếp, hoặc ở Đang mở để mở (nội dung khóa lại).
   - Phiên bản đã khóa (Đang mở / Đã đóng) chỉ đổi được trạng thái. Sửa nội dung của nó thì trình soạn tự chép ra phiên bản mới;
     nếu đang có phiên bản Nháp thì phiên bản đã khóa chỉ xem được.
   Mẫu xuất file (đơn và thống kê; hai nút tròn nổi ở cạnh phải, mỗi nút mở một khung nổi) thuộc loại đơn (mọi phiên bản): thêm, đổi tên, xóa mẫu cũng là thay đổi chưa lưu, bấm Lưu thì gửi lên
   sau khi lưu loại đơn (kể cả khi đang xem phiên bản đã khóa).
   Thay đổi chưa lưu được giữ lại khi đi trang khác (formTypeDrafts.ts). */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router';
import {
  DRAFT_SAVE_STATUSES,
  EXPORT_MESSAGES,
  FORM_TYPE_MESSAGES,
  FORM_TYPE_STATUS_LABEL,
  LOCKED_VERSION_STATUSES,
  issueMessages,
  validateFormTypeDraft,
  type FormSection,
  type FormTypeStatus,
  type ManagedFormType,
  type SaveFormTypeVersionRequest,
} from '@ulaw/shared';
import {
  useDeleteFormTypeVersion,
  useFormTypes,
  useManagedFormType,
  useSaveFormTypeVersion,
  useSetFormTypeVersionStatus,
  type SaveFormTypeVersionTarget,
} from '../../api/form-types';
import { useSaveExportTemplates } from '../../api/exports';
import { FORM_TYPE_VERSION_PARAM, NEW_FORM_TYPE_ID, PAGE_LABEL, PAGE_PATH, formTypeEditorPath, readPreviousPageLabel } from '../../app/paths';
import { Button } from '../../components/Button';
import { LoadError, loadErrorMessage } from '../../components/LoadError';
import { Modal } from '../../components/Modal';
import { RefreshButton } from '../../components/RefreshButton';
import { useToast } from '../../components/Toast';
import { DraftIssuesContext } from './draftIssues';
import { StatsExportButton } from '../../features/export/StatsExportButton';
import { ExportTemplatesDock } from './ExportTemplatesDock';
import { NO_TEMPLATE_CHANGES, hasTemplateChanges, toSaveTemplatesRequest } from './exportTemplateChanges';
import { FormTypeInfoCard } from './FormTypeInfoCard';
import { FormInfoPanelToggle, useFormInfoPanel } from '../form/FormInfoPanel';
import { FormTypePreview } from './FormTypePreview';
import { FormTypeVersionPanel, VERSION_PANEL_STORAGE_KEY, VERSION_PANEL_TITLE, type VersionChoice } from './FormTypeVersionPanel';
import { draftFromVersion, moveItem, sameDraft, newFormTypeDraft, newSection, removeAt, replaceAt, type FormTypeDraft } from './formTypeDraft';
import {
  discardTemplateChanges,
  discardUnsavedEdit,
  keepTemplateChanges,
  keepUnsavedEdit,
  readTemplateChanges,
  readUnsavedEdit,
  type UnsavedEdit,
} from './formTypeDrafts';
import { SectionEditor, type SectionAction } from './SectionEditor';
import styles from './FormTypeEditor.module.css';

/** Câu báo khi không tải được loại đơn mà máy chủ không gửi kèm câu báo lỗi (vd mất mạng). */
const LOAD_FAILED_TEXT = 'Không tải được loại đơn.';

/** Hai chế độ của trình soạn: soạn, xem trước. */
type EditorMode = 'edit' | 'preview';
const EDITOR_MODES: readonly (readonly [EditorMode, string])[] = [
  ['edit', 'Soạn'],
  ['preview', 'Xem trước'],
];

/**
 * Trang trình soạn: tạo mới thì soạn ngay từ bản trống; sửa thì tải loại đơn (kèm mọi phiên bản) rồi soạn.
 * @returns  giao diện trang
 */
export function FormTypeEditorPage() {
  const { formTypeId = NEW_FORM_TYPE_ID } = useParams();
  const [searchParams] = useSearchParams();
  const requestedVersion = Number(searchParams.get(FORM_TYPE_VERSION_PARAM)) || null;
  const isNew = formTypeId === NEW_FORM_TYPE_ID;
  const { backLabel, goBack } = useLeaveEditor();

  return (
    <div className={styles.page}>
      <button type="button" className={styles.back} onClick={goBack}>
        ‹ Quay lại {backLabel}
      </button>
      {isNew ? (
        <FormTypeEditor key="new" managed={null} requestedVersion={null} />
      ) : (
        <SavedFormTypeEditor key={formTypeId} formTypeId={formTypeId} requestedVersion={requestedVersion} />
      )}
    </div>
  );
}

/**
 * Cách rời trình soạn: mở từ trang khác thì quay về trang đó; mở thẳng đường dẫn thì về Quản lí loại đơn.
 * @returns  backLabel: tên trang sẽ về · goBack: hàm quay lại
 */
function useLeaveEditor() {
  const navigate = useNavigate();
  const location = useLocation();
  const previousPageLabel = location.key === 'default' ? undefined : readPreviousPageLabel(location.state);
  if (previousPageLabel) return { backLabel: previousPageLabel, goBack: () => navigate(-1) };
  return {
    backLabel: PAGE_LABEL.formTypes,
    goBack: () => navigate(PAGE_PATH.formTypes, { replace: true }),
  };
}

/**
 * Tải loại đơn kèm mọi phiên bản rồi mở trình soạn.
 * @param formTypeId        mã loại đơn
 * @param requestedVersion  phiên bản muốn mở (từ đường dẫn); null = mặc định
 * @returns                 đang tải / câu báo lỗi kèm nút ↻ / trình soạn
 */
function SavedFormTypeEditor({ formTypeId, requestedVersion }: { formTypeId: string; requestedVersion: number | null }) {
  const managedQuery = useManagedFormType(formTypeId);
  if (managedQuery.isPending) return <p className={styles.muted}>Đang tải loại đơn…</p>;
  if (!managedQuery.data) {
    return (
      <section className={styles.errorCard}>
        <LoadError message={loadErrorMessage(managedQuery) ?? LOAD_FAILED_TEXT} />
        <RefreshButton query={managedQuery} label="loại đơn" />
      </section>
    );
  }
  return <FormTypeEditor managed={managedQuery.data} requestedVersion={requestedVersion} />;
}

/**
 * Đổi bản soạn thành dữ liệu gửi lên máy chủ: bỏ khoảng trắng thừa ở tên, mô tả; mô tả trống thành null.
 * @param draft  bản soạn (trạng thái Nháp hoặc Đang mở)
 * @returns      body của lệnh lưu
 */
function toSaveRequest(draft: FormTypeDraft): SaveFormTypeVersionRequest {
  return {
    prefix: draft.prefix,
    name: draft.name.trim(),
    description: draft.description.trim() || null,
    status: draft.status === 'open' ? 'open' : 'draft',
    sections: draft.sections,
  };
}

/**
 * Đưa con trỏ tới ô lỗi đầu tiên trong trình soạn; lỗi chung (không gắn với ô nào) chỉ báo bằng thông báo.
 * Gọi sau khi giao diện đã vẽ lại với các ô lỗi.
 */
function focusFirstIssue(): void {
  const firstInvalid = document.querySelector<HTMLElement>('#editor-panel-edit [aria-invalid="true"]');
  if (firstInvalid) {
    firstInvalid.scrollIntoView({ block: 'center', behavior: 'smooth' });
    firstInvalid.focus({ preventScroll: true });
  }
}

/**
 * Câu giải thích dưới các nút trạng thái.
 * @param status            trạng thái đang chọn
 * @param isLockedVersion   phiên bản đã khóa (chọn Đang mở / Đã đóng)
 * @param savedStatus       trạng thái đang lưu của phiên bản; phiên bản chưa lưu thì null
 * @param otherOpenVersion  phiên bản khác đang mở (sẽ tự đóng khi mở phiên bản này); không có thì null
 * @returns                 câu giải thích
 */
function statusHintOf(status: FormTypeStatus, isLockedVersion: boolean, savedStatus: FormTypeStatus | null, otherOpenVersion: number | null): string {
  const autoClose = otherOpenVersion ? `; phiên bản ${otherOpenVersion} đang mở sẽ tự chuyển sang Đã đóng` : '';
  if (status === 'draft') return 'Người nộp đơn chưa thấy phiên bản này. Lưu ở Nháp để soạn tiếp lúc khác.';
  if (status === 'closed') return 'Không nhận đơn mới theo phiên bản này; các đơn đã nộp vẫn xử lí bình thường.';
  if (savedStatus === 'open') return 'Người nộp đơn đang nộp theo phiên bản này.';
  if (isLockedVersion) return `Bấm Lưu để mở lại phiên bản này${autoClose}.`;
  return `Bấm Lưu để mở phiên bản này: người nộp đơn chọn được khi bấm “Nộp đơn mới”, nội dung khóa lại không sửa được nữa${autoClose}.`;
}

interface FormTypeEditorProps {
  /** Loại đơn kèm mọi phiên bản; tạo mới thì null */
  managed: ManagedFormType | null;
  /** Phiên bản muốn mở trước (từ đường dẫn); null = phiên bản đang sửa dở, không có thì phiên bản mới nhất */
  requestedVersion: number | null;
}

/**
 * Trình soạn một loại đơn theo phiên bản.
 * @param props  xem FormTypeEditorProps
 * @returns      tiêu đề, tab, khung báo lỗi, thẻ thông tin, các phần, hàng nút cuối, khung Phiên bản, hộp xác nhận xóa
 */
function FormTypeEditor({ managed, requestedVersion }: FormTypeEditorProps) {
  const isNew = managed === null;
  const formTypeId = managed?.id ?? NEW_FORM_TYPE_ID;
  const versions = useMemo(() => managed?.versions ?? [], [managed]);
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const formTypesQuery = useFormTypes();
  const saveVersion = useSaveFormTypeVersion();
  const setVersionStatus = useSetFormTypeVersionStatus(formTypeId);
  const deleteVersion = useDeleteFormTypeVersion(formTypeId);
  const saveTemplates = useSaveExportTemplates();
  const versionPanel = useFormInfoPanel(VERSION_PANEL_STORAGE_KEY);

  // Thay đổi chưa lưu (giữ lại từ lần trước nếu có), phiên bản đang xem, trạng thái mới chọn cho phiên bản đã khóa
  const [edit, setEdit] = useState<UnsavedEdit | null>(() => readUnsavedEdit(formTypeId) ?? null);
  // Thay đổi chưa lưu về mẫu xuất file (không theo phiên bản)
  const [templateChanges, setTemplateChanges] = useState(() => readTemplateChanges(formTypeId) ?? NO_TEMPLATE_CHANGES);
  const [selectedVersion, setSelectedVersion] = useState(() => {
    if (requestedVersion && versions.some((version) => version.version === requestedVersion)) return requestedVersion;
    return edit?.version ?? versions[0]?.version ?? 1;
  });
  const [statusChange, setStatusChange] = useState<{
    version: number;
    status: FormTypeStatus;
  } | null>(null);
  const [emptyDraft] = useState(newFormTypeDraft);
  const [editorMode, setEditorMode] = useState<EditorMode>('edit');
  // Phần / câu hỏi vừa thêm: đưa con trỏ vào ô đầu tiên của nó
  const [focusTarget, setFocusTarget] = useState<{
    sectionId: string | null;
    questionId: string | null;
  }>({ sectionId: null, questionId: null });
  // Đã bấm Lưu mà còn lỗi: từ đó kiểm tra lại mỗi lần sửa, sửa hết lỗi thì khung báo lỗi tự ẩn
  const [showIssues, setShowIssues] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // Mở trình soạn ở phiên bản khác qua đường dẫn (vd bấm dòng phiên bản cũ trong bảng)
  useEffect(() => {
    if (requestedVersion && versions.some((version) => version.version === requestedVersion)) setSelectedVersion(requestedVersion);
  }, [requestedVersion, versions]);

  // Giữ thay đổi chưa lưu để đi trang khác rồi quay lại vẫn còn. Sửa tay về đúng như lúc bắt đầu thì coi như không còn thay đổi:
  // bỏ bản đang sửa (phiên bản mới chép ra thì bỏ luôn, quay về phiên bản đã chép)
  useEffect(() => {
    if (!edit) return;
    if (!sameDraft(edit.draft, edit.baseDraft)) {
      keepUnsavedEdit(formTypeId, edit);
      return;
    }
    if (edit.isNewVersion && edit.baseVersion !== null) setSelectedVersion(edit.baseVersion);
    discardUnsavedEdit(formTypeId);
    setEdit(null);
  }, [formTypeId, edit]);
  useEffect(() => keepTemplateChanges(formTypeId, templateChanges), [formTypeId, templateChanges]);

  // Phiên bản đang xem: đã lưu chưa, có đang sửa không, sửa được không
  const selectedSaved = versions.find((version) => version.version === selectedVersion) ?? null;
  const editingSelected = edit !== null && edit.version === selectedVersion;
  const savedDraftVersion = versions.find((version) => version.status === 'draft')?.version ?? null;
  const isLockedVersion = !editingSelected && selectedSaved !== null && selectedSaved.status !== 'draft';
  // Phiên bản đã khóa: sửa nội dung thì chép ra phiên bản mới, trừ khi đang có phiên bản khác đang soạn
  const canStartNewVersion = isLockedVersion && savedDraftVersion === null && edit === null;
  const contentLocked = isLockedVersion && !canStartNewVersion;
  const draftInProgress = edit?.version ?? savedDraftVersion;
  const latestVersionNumber = versions[0]?.version ?? 0;

  // Bản soạn đang hiện
  const savedDraft = useMemo(() => (managed && selectedSaved ? draftFromVersion(managed.prefix, selectedSaved) : null), [managed, selectedSaved]);
  const shownDraft = editingSelected ? edit.draft : (savedDraft ?? edit?.draft ?? emptyDraft);
  // Bản soạn đang hiện cho khung Mẫu xuất file (kiểm tra mã, ví dụ theo câu hỏi đang soạn)
  const exportDraft = useMemo(
    () => ({ name: shownDraft.name, prefix: shownDraft.prefix, sections: shownDraft.sections }),
    [shownDraft.name, shownDraft.prefix, shownDraft.sections],
  );
  const shownStatus = isLockedVersion && statusChange?.version === selectedVersion ? statusChange.status : shownDraft.status;
  const otherOpenVersion = versions.find((version) => version.status === 'open' && version.version !== selectedVersion)?.version ?? null;
  // Chỉ tính thay đổi của phiên bản đang xem: phiên bản khác đang sửa dở thì "Chưa lưu", "Bỏ thay đổi" không hiện ở đây
  // (khung Phiên bản vẫn ghi "Chưa lưu" ở phiên bản đó). Thay đổi về mẫu xuất file thì tính ở mọi phiên bản.
  const statusChanged = isLockedVersion && statusChange?.version === selectedVersion;
  const templatesChanged = hasTemplateChanges(templateChanges);
  const dirty = editingSelected || statusChanged || templatesChanged;

  // Lỗi của bản soạn (chỉ sau khi đã bấm Lưu); mã đơn so với các loại đơn khác trong danh sách đã tải
  const otherPrefixes = useMemo(
    () => (formTypesQuery.data ?? []).filter((formType) => formType.id !== managed?.id).map((formType) => formType.prefix),
    [formTypesQuery.data, managed?.id],
  );
  const issues = useMemo(
    () => (showIssues && !isLockedVersion ? validateFormTypeDraft(shownDraft, otherPrefixes) : []),
    [showIssues, isLockedVersion, shownDraft, otherPrefixes],
  );
  const invalidTargets = useMemo(() => new Set(issues.flatMap((issue) => (issue.target ? [issue.target] : []))), [issues]);

  /**
   * Sửa bản soạn của phiên bản đang xem. Phiên bản Nháp: sửa thẳng. Phiên bản đã khóa (chưa có phiên bản nào đang soạn):
   * chép ra phiên bản mới ở trạng thái Nháp rồi sửa trên đó, chuyển sang xem phiên bản mới.
   * @param changeDraft  hàm nhận bản cũ, trả bản mới
   */
  const editDraft = (changeDraft: (current: FormTypeDraft) => FormTypeDraft) => {
    if (contentLocked) return;
    if (editingSelected) {
      // Bản đang sửa có thể vừa bị bỏ (sửa về đúng như lúc đầu) mà trang chưa kịp vẽ lại, vd bộ gõ tiếng Việt
      // xóa "d" rồi chèn "Đ" liền nhau: khi đó sửa tiếp trên bản ngay trước, không bỏ mất chữ vừa gõ
      setEdit((current) => {
        const latestEdit = current ?? edit;
        return latestEdit && { ...latestEdit, draft: changeDraft(latestEdit.draft) };
      });
      return;
    }
    if (isNew || selectedSaved?.status === 'draft') {
      setEdit({
        version: selectedVersion,
        isNewVersion: isNew,
        baseVersion: null,
        baseDraft: shownDraft,
        draft: changeDraft(shownDraft),
      });
      return;
    }
    const newVersion = latestVersionNumber + 1;
    const copiedDraft: FormTypeDraft = { ...shownDraft, status: 'draft' };
    setEdit({
      version: newVersion,
      isNewVersion: true,
      baseVersion: selectedVersion,
      baseDraft: copiedDraft,
      draft: changeDraft(copiedDraft),
    });
    setSelectedVersion(newVersion);
    setStatusChange(null);
  };
  const setSections = (changeSections: (sections: FormSection[]) => FormSection[]) =>
    editDraft((current) => ({
      ...current,
      sections: changeSections(current.sections),
    }));

  /**
   * Chọn trạng thái: phiên bản đã khóa thì ghi nhận để Lưu đổi trạng thái; phiên bản Nháp thì là một phần của bản soạn.
   * @param status  trạng thái mới
   */
  const changeStatus = (status: FormTypeStatus) => {
    if (isLockedVersion) {
      setStatusChange(status === selectedSaved.status ? null : { version: selectedVersion, status });
      return;
    }
    editDraft((current) => ({ ...current, status }));
  };

  /**
   * Làm một việc với phần ở vị trí index.
   * @param index   vị trí phần
   * @param action  đưa lên, đưa xuống, xóa
   */
  const actOnSection = (index: number, action: SectionAction) => {
    if (action === 'moveUp') setSections((sections) => moveItem(sections, index, index - 1));
    else if (action === 'moveDown') setSections((sections) => moveItem(sections, index, index + 1));
    else setSections((sections) => removeAt(sections, index));
  };

  /** Thêm phần mới ở cuối (có sẵn một câu hỏi trống), đưa con trỏ vào ô tiêu đề phần. */
  const addSection = () => {
    const section = newSection();
    setSections((sections) => [...sections, section]);
    setFocusTarget({ sectionId: section.id, questionId: null });
  };

  /**
   * Chuyển giữa Soạn và Xem trước, về đầu trang. Bỏ đích đưa con trỏ, để quay lại tab Soạn không nhảy về ô vừa thêm lần trước.
   * @param mode  chế độ muốn mở
   */
  const changeEditorMode = (mode: EditorMode) => {
    setEditorMode(mode);
    setFocusTarget({ sectionId: null, questionId: null });
    window.scrollTo({ top: 0 });
  };

  /**
   * Xem một phiên bản khác. Trạng thái mới chọn cho phiên bản đã khóa (chưa lưu) thì bỏ.
   * @param version  số phiên bản
   */
  const selectVersion = (version: number) => {
    setSelectedVersion(version);
    setStatusChange(null);
    setShowIssues(false);
    setFocusTarget({ sectionId: null, questionId: null });
  };

  /**
   * Lưu (về tab Soạn), lần lượt từng phần có thay đổi; một phần lỗi thì báo và dừng, các thay đổi chưa lưu vẫn giữ:
   * 1. Phiên bản đã khóa: đổi trạng thái (mở thì phiên bản đang mở khác tự đóng).
   * 2. Phiên bản Nháp / loại đơn mới: kiểm tra bản soạn (còn lỗi: tô đỏ, liệt kê, đưa con trỏ tới ô lỗi đầu tiên, không lưu gì)
   *    rồi tạo loại đơn, thêm phiên bản mới, hoặc lưu đè phiên bản Nháp.
   * 3. Mẫu xuất file: gửi mọi thay đổi cùng các file mới trong một lần (loại đơn mới thì sau khi đã tạo).
   */
  const save = async () => {
    setEditorMode('edit');
    const contentChanged = !isLockedVersion && (editingSelected || isNew);
    if (!contentChanged && !statusChanged && !templatesChanged) {
      toast('Không có thay đổi để lưu.', 'info');
      return;
    }

    // Kiểm tra bản soạn trước khi gửi
    if (contentChanged) {
      setShowIssues(true);
      const draftIssues = issueMessages(validateFormTypeDraft(shownDraft, otherPrefixes));
      if (draftIssues.length) {
        const otherCount = draftIssues.length - 1;
        toast(`${draftIssues[0]}${otherCount ? ` (còn ${otherCount} lỗi khác, xem các ô tô đỏ)` : ''}`, 'error');
        setTimeout(focusFirstIssue);
        return;
      }
    }

    // 1. Trạng thái của phiên bản đã khóa
    if (statusChanged && statusChange && selectedSaved) {
      const { version, status } = statusChange;
      try {
        await setVersionStatus.mutateAsync({ version, status: status === 'open' ? 'open' : 'closed' });
      } catch (error) {
        toast(error instanceof Error ? error.message : String(error), 'error');
        return;
      }
      setStatusChange(null);
      toast(
        status === 'open' ? FORM_TYPE_MESSAGES.opened(selectedSaved.name, version, otherOpenVersion) : FORM_TYPE_MESSAGES.closed(selectedSaved.name, version),
        'success',
      );
    }

    // 2. Nội dung: tạo loại đơn, thêm phiên bản mới, hoặc lưu đè phiên bản Nháp
    let savedFormTypeId = formTypeId;
    let savedVersion: number | null = null;
    if (contentChanged) {
      const target: SaveFormTypeVersionTarget = isNew
        ? { kind: 'createFormType' }
        : edit?.isNewVersion
          ? { kind: 'addVersion', formTypeId }
          : { kind: 'saveDraft', formTypeId, version: selectedVersion };
      try {
        const savedFormType = await saveVersion.mutateAsync({ target, saveRequest: toSaveRequest(shownDraft) });
        savedFormTypeId = savedFormType.id;
        savedVersion = target.kind === 'saveDraft' ? selectedVersion : savedFormType.versions[0]!.version;
      } catch (error) {
        toast(error instanceof Error ? error.message : String(error), 'error');
        return;
      }
      const name = shownDraft.name.trim();
      discardUnsavedEdit(formTypeId);
      setEdit(null);
      setShowIssues(false);
      toast(
        shownDraft.status === 'open'
          ? FORM_TYPE_MESSAGES.opened(name, savedVersion, otherOpenVersion)
          : FORM_TYPE_MESSAGES.saved(name, savedVersion, FORM_TYPE_STATUS_LABEL.draft),
        'success',
      );
    }

    // 3. Mẫu xuất file. Lỗi thì giữ các thay đổi (loại đơn vừa tạo thì chuyển sang giữ theo mã mới) để bấm Lưu lại
    if (templatesChanged) {
      try {
        await saveTemplates.mutateAsync({ formTypeId: savedFormTypeId, ...toSaveTemplatesRequest(templateChanges) });
        discardTemplateChanges(formTypeId);
        setTemplateChanges(NO_TEMPLATE_CHANGES);
        if (!contentChanged && !statusChanged) toast(EXPORT_MESSAGES.saved, 'success');
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        toast(contentChanged || statusChanged ? EXPORT_MESSAGES.notSaved(reason) : reason, 'error');
        if (isNew) {
          keepTemplateChanges(savedFormTypeId, templateChanges);
          discardTemplateChanges(formTypeId);
        }
      }
    }

    // Loại đơn mới: mở trình soạn của loại đơn vừa tạo; còn lại xem phiên bản vừa lưu
    if (isNew) navigate(formTypeEditorPath(savedFormTypeId), { replace: true, state: location.state });
    else if (savedVersion !== null) setSelectedVersion(savedVersion);
  };

  /** Bỏ thay đổi (cả thay đổi về mẫu xuất file): về bản đã lưu; đang soạn phiên bản mới (chưa lưu) thì quay về phiên bản đã chép ra. */
  const discardChanges = () => {
    if (edit?.isNewVersion) setSelectedVersion(edit.baseVersion ?? versions[0]?.version ?? 1);
    discardUnsavedEdit(formTypeId);
    discardTemplateChanges(formTypeId);
    setEdit(null);
    setTemplateChanges(NO_TEMPLATE_CHANGES);
    setStatusChange(null);
    setShowIssues(false);
    toast(FORM_TYPE_MESSAGES.discarded, 'info');
  };

  /** Xóa phiên bản Nháp đang xem (đã xác nhận); phiên bản duy nhất thì xóa luôn loại đơn và về trang Quản lí loại đơn. */
  const removeDraftVersion = () => {
    if (!selectedSaved) return;
    const { version, name } = selectedSaved;
    deleteVersion.mutate(version, {
      onSuccess: (remaining) => {
        discardUnsavedEdit(formTypeId);
        setEdit(null);
        setConfirmingDelete(false);
        if (!remaining) {
          discardTemplateChanges(formTypeId);
          toast(FORM_TYPE_MESSAGES.deleted(name), 'success');
          navigate(PAGE_PATH.formTypes, { replace: true });
          return;
        }
        toast(FORM_TYPE_MESSAGES.draftDeleted(version), 'success');
        setSelectedVersion(remaining.versions[0]!.version);
      },
      onError: (error) => {
        setConfirmingDelete(false);
        toast(error.message, 'error');
      },
    });
  };

  // Các phiên bản để chọn: phiên bản mới đang soạn (chưa lưu) đứng đầu, rồi các phiên bản đã lưu, mới trước.
  // Phiên bản đang sửa dở thì ghi tên theo bản đang sửa.
  const versionChoices: VersionChoice[] = [
    ...(edit?.isNewVersion && !isNew
      ? [
          {
            version: edit.version,
            name: edit.draft.name,
            prefix: edit.draft.prefix,
            description: edit.draft.description,
            status: edit.draft.status,
            unsaved: true,
          },
        ]
      : []),
    ...versions.map((version) => {
      const editedDraft = edit?.version === version.version ? edit.draft : null;
      const pendingStatus = statusChange?.version === version.version ? statusChange.status : null;
      return {
        version: version.version,
        name: editedDraft?.name ?? version.name,
        prefix: managed?.prefix ?? '',
        description: editedDraft?.description ?? version.description,
        status: pendingStatus ?? editedDraft?.status ?? version.status,
        unsaved: editedDraft !== null || pendingStatus !== null,
      };
    }),
  ];
  const showsVersionPanel = !isNew;

  // Câu nhắc ở đầu trang. Tab Xem trước: báo đây là bản xem trước. Tab Soạn: về phiên bản đang xem
  // (phiên bản mới chép ra, phiên bản đã khóa sửa được bằng cách chép, hoặc chỉ xem được)
  let pageNotice: ReactNode = null;
  if (editorMode === 'preview') {
    pageNotice = (
      <p className={styles.previewNotice} role="note">
        Đây là bản xem trước, giống như người nộp đơn sẽ thấy. Bạn có thể thử điền nhưng không có gì được lưu.
      </p>
    );
  } else if (editorMode === 'edit' && editingSelected && edit.isNewVersion && edit.baseVersion !== null) {
    pageNotice = (
      <p className={styles.versionNotice}>
        <b>
          Phiên bản {edit.version} chép từ phiên bản {edit.baseVersion}, chưa lưu.
        </b>{' '}
        Phiên bản {edit.baseVersion} giữ nguyên. Lưu ở trạng thái Nháp để soạn tiếp lúc khác, hoặc Đang mở để mở luôn.
      </p>
    );
  } else if (editorMode === 'edit' && canStartNewVersion) {
    pageNotice = (
      <p className={styles.versionNotice}>
        <b>Phiên bản {selectedVersion} đã phát hành nên nội dung đã khóa.</b> Sửa bất kì chỗ nào sẽ tạo phiên bản {latestVersionNumber + 1} chép từ
        phiên bản này; phiên bản {selectedVersion} giữ nguyên.
      </p>
    );
  } else if (editorMode === 'edit' && contentLocked && draftInProgress !== null) {
    pageNotice = (
      <p className={styles.versionNotice}>
        <b>Phiên bản {selectedVersion} đã phát hành nên chỉ xem được.</b> Đang soạn phiên bản {draftInProgress}.{' '}
        <button type="button" className={styles.inlineLink} onClick={() => selectVersion(draftInProgress)}>
          Mở phiên bản {draftInProgress}
        </button>
      </p>
    );
  }
  const deletesWholeFormType = versions.length === 1;
  const isSaving = saveVersion.isPending || setVersionStatus.isPending || saveTemplates.isPending;

  return (
    <DraftIssuesContext.Provider value={invalidTargets}>
      <div className={styles.head}>
        <h1 className={styles.title}>{isNew ? 'Tạo loại đơn' : `Soạn loại đơn ${versions[0]!.name}`}</h1>
        <div className={styles.headActions}>
          {/* Xuất thống kê theo mẫu thống kê đã lưu (loại đơn mới chưa lưu thì chưa có) */}
          {managed && <StatsExportButton formTypeId={managed.id} />}
          {showsVersionPanel && <FormInfoPanelToggle panel={versionPanel} label={`${VERSION_PANEL_TITLE} ${selectedVersion}`} />}
          <div className={styles.tabs} role="tablist" aria-label="Chế độ">
            {EDITOR_MODES.map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                role="tab"
                id={`editor-tab-${mode}`}
                aria-selected={editorMode === mode}
                aria-controls={`editor-panel-${mode}`}
                className={styles.tab}
                onClick={() => changeEditorMode(mode)}
              >
                {label}
              </button>
            ))}
          </div>
          {dirty && <span className={styles.dirty}>Chưa lưu</span>}
        </div>
      </div>

      {/* Khung câu nhắc: dài hết bề ngang trang, trên cả nội dung và khung Phiên bản (như khung thông báo ở trang chi tiết đơn) */}
      {pageNotice && <div className={styles.notices}>{pageNotice}</div>}

      {/* Nội dung soạn; khung Phiên bản đang nằm bên phải thì chia 2 cột */}
      <div className={`${styles.layout} ${showsVersionPanel && !versionPanel.isNarrow && versionPanel.isOpen ? styles.withSide : ''}`}>
        <div className={styles.main}>
          {/* Xem trước: dựng lại mỗi lần mở tab hoặc đổi phiên bản, nên luôn theo bản đang hiện và câu trả lời thử bắt đầu từ trống */}
          {editorMode === 'preview' && (
            <div id="editor-panel-preview" role="tabpanel" aria-labelledby="editor-tab-preview">
              <FormTypePreview key={selectedVersion} draft={shownDraft} />
            </div>
          )}

          {/* Soạn: chỉ ẩn khi xem trước, không bỏ khỏi trang */}
          <div id="editor-panel-edit" role="tabpanel" aria-labelledby="editor-tab-edit" className={styles.editor} hidden={editorMode !== 'edit'}>
            <FormTypeInfoCard
              draft={shownDraft}
              prefixLocked={managed?.prefixLocked ?? false}
              contentLocked={contentLocked}
              status={shownStatus}
              statusChoices={isLockedVersion ? LOCKED_VERSION_STATUSES : DRAFT_SAVE_STATUSES}
              statusHint={statusHintOf(shownStatus, isLockedVersion, selectedSaved?.status ?? null, otherOpenVersion)}
              onChange={(changes) => editDraft((current) => ({ ...current, ...changes }))}
              onStatusChange={changeStatus}
            />

            {/* Các phần: phiên bản chỉ xem được thì khóa mọi ô và nút bên trong */}
            <fieldset className={styles.sectionList} disabled={contentLocked}>
              {shownDraft.sections.map((section, index) => (
                <SectionEditor
                  key={section.id}
                  section={section}
                  index={index}
                  sectionCount={shownDraft.sections.length}
                  focusQuestionId={focusTarget.questionId}
                  autoFocus={section.id === focusTarget.sectionId}
                  onChange={(nextSection) => setSections((sections) => replaceAt(sections, index, nextSection))}
                  onAction={(action) => actOnSection(index, action)}
                  onQuestionAdded={(questionId) => setFocusTarget({ sectionId: null, questionId })}
                />
              ))}

              {/* Nút thêm phần: ngay dưới phần cuối */}
              <div>
                <Button onClick={addSection}>+ Thêm phần</Button>
              </div>
            </fieldset>

            {/* Mẫu xuất file đơn (Word) và thống kê (Excel): hai nút tròn nổi ở cạnh phải, mỗi nút mở một khung nổi
                (nằm trong phần Soạn nên tab Xem trước thì ẩn). Thuộc loại đơn (mọi phiên bản) nên không bị khóa theo phiên bản;
                hai khung dùng chung một bộ thay đổi, chờ bấm Lưu */}
            <ExportTemplatesDock
              formTypeId={managed?.id ?? null}
              draft={exportDraft}
              version={selectedVersion}
              changes={templateChanges}
              onChangesChange={setTemplateChanges}
              saving={isSaving}
            />

            <div className={styles.bottom}>
              <span className={styles.spacer} />
              {selectedSaved?.status === 'draft' && (
                <Button variant="danger" onClick={() => setConfirmingDelete(true)}>
                  {deletesWholeFormType ? 'Xóa loại đơn' : 'Xóa bản nháp'}
                </Button>
              )}

              {/* Bỏ thay đổi · Lưu: đi thành cặp, chỉ hiện khi phiên bản đang xem có thay đổi */}
              {dirty && (
                <>
                  <Button onClick={discardChanges} disabled={isSaving}>
                    Bỏ thay đổi
                  </Button>
                  <Button variant="primary" onClick={() => void save()} disabled={isSaving}>
                    {isSaving ? 'Đang lưu…' : 'Lưu'}
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>

        {showsVersionPanel && (
          <FormTypeVersionPanel panel={versionPanel} choices={versionChoices} selectedVersion={selectedVersion} onSelect={selectVersion} />
        )}
      </div>

      {/* Xác nhận xóa phiên bản Nháp (phiên bản duy nhất thì xóa luôn loại đơn) */}
      <Modal
        open={confirmingDelete}
        onClose={() => !deleteVersion.isPending && setConfirmingDelete(false)}
        title={deletesWholeFormType ? `Xóa loại đơn ${selectedSaved?.name ?? ''}?` : `Xóa phiên bản nháp ${selectedVersion}?`}
      >
        <p className={styles.hint}>
          {deletesWholeFormType
            ? 'Loại đơn này chưa phát hành lần nào. Xóa rồi thì không lấy lại được.'
            : `Các phiên bản đã phát hành giữ nguyên. Xóa rồi thì không lấy lại được phiên bản ${selectedVersion}.`}
        </p>
        <div className={styles.dialogButtons}>
          <Button variant="ghost" onClick={() => setConfirmingDelete(false)} disabled={deleteVersion.isPending}>
            Hủy
          </Button>
          <Button variant="danger" onClick={removeDraftVersion} disabled={deleteVersion.isPending}>
            {deleteVersion.isPending ? 'Đang xóa…' : deletesWholeFormType ? 'Xóa loại đơn' : 'Xóa bản nháp'}
          </Button>
        </div>
      </Modal>
    </DraftIssuesContext.Provider>
  );
}
