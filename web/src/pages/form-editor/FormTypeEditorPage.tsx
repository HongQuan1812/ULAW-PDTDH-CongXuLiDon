/* Trình soạn loại đơn (#/soan-don/<mã loại đơn>, tạo mới: #/soan-don/moi), như phần "Trình soạn" của artifact/js/forms-page.js.
   Gồm: nút quay lại, tiêu đề, tab Soạn / Xem trước, nhãn "Chưa lưu", khung báo lỗi,
   thẻ Thông tin loại đơn, các phần và câu hỏi, hàng nút cuối (+ Thêm phần · Bỏ thay đổi · Xóa loại đơn · Lưu).
   Bản soạn chưa lưu được giữ lại khi đi trang khác (formTypeDrafts.ts). */
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';
import {
  FORM_TYPE_MESSAGES,
  FORM_TYPE_STATUS_LABEL,
  canChooseDraftStatus,
  issueMessages,
  validateFormTypeDraft,
  type FormSection,
  type FormType,
  type SaveFormTypeRequest,
} from '@ulaw/shared';
import { useDeleteFormType, useFormType, useFormTypes, useSaveFormType } from '../../api/form-types';
import { NEW_FORM_TYPE_ID, PAGE_LABEL, PAGE_PATH, formTypeEditorPath, readPreviousPageLabel } from '../../app/paths';
import { Button } from '../../components/Button';
import { LoadError, loadErrorMessage } from '../../components/LoadError';
import { Modal } from '../../components/Modal';
import { RefreshButton } from '../../components/RefreshButton';
import { useToast } from '../../components/Toast';
import { DraftIssuesContext } from './draftIssues';
import { FormTypeInfoCard } from './FormTypeInfoCard';
import { FormTypePreview } from './FormTypePreview';
import { draftFromFormType, moveItem, newFormTypeDraft, newSection, removeAt, replaceAt, type FormTypeDraft } from './formTypeDraft';
import { discardFormTypeDraft, keepFormTypeDraft, readFormTypeDraft } from './formTypeDrafts';
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
 * Trang trình soạn: tạo mới thì soạn ngay từ bản trống; sửa thì tải loại đơn rồi soạn.
 * @returns  giao diện trang
 */
export function FormTypeEditorPage() {
  const { formTypeId = NEW_FORM_TYPE_ID } = useParams();
  const isNew = formTypeId === NEW_FORM_TYPE_ID;
  const { backLabel, goBack } = useLeaveEditor();

  return (
    <div className={styles.page}>
      <button type="button" className={styles.back} onClick={goBack}>
        ‹ Quay lại {backLabel}
      </button>
      {isNew ? <FormTypeEditor key="new" savedFormType={null} formCount={0} /> : <SavedFormTypeEditor key={formTypeId} formTypeId={formTypeId} />}
    </div>
  );
}

/**
 * Cách rời trình soạn (như #feBack của bản mẫu): mở từ trang khác thì quay về trang đó; mở thẳng đường dẫn thì về Quản lí loại đơn.
 * @returns  backLabel: tên trang sẽ về · goBack: hàm quay lại
 */
function useLeaveEditor() {
  const navigate = useNavigate();
  const location = useLocation();
  const previousPageLabel = location.key === 'default' ? undefined : readPreviousPageLabel(location.state);
  if (previousPageLabel) return { backLabel: previousPageLabel, goBack: () => navigate(-1) };
  return { backLabel: PAGE_LABEL.formTypes, goBack: () => navigate(PAGE_PATH.formTypes, { replace: true }) };
}

/**
 * Tải loại đơn đã lưu và danh sách loại đơn (để biết số đơn đã nộp), rồi mở trình soạn.
 * @param formTypeId  mã loại đơn
 * @returns           đang tải / câu báo lỗi kèm nút ↻ / trình soạn
 */
function SavedFormTypeEditor({ formTypeId }: { formTypeId: string }) {
  const formTypeQuery = useFormType(formTypeId);
  const formTypesQuery = useFormTypes();
  if (formTypeQuery.isPending || formTypesQuery.isPending) return <p className={styles.muted}>Đang tải loại đơn…</p>;

  // Không tải được loại đơn, hoặc danh sách loại đơn: báo lỗi kèm nút tải lại đúng phần bị lỗi
  const savedFormType = formTypeQuery.data;
  const formTypes = formTypesQuery.data;
  if (!savedFormType || !formTypes) {
    const failedQuery = savedFormType ? formTypesQuery : formTypeQuery;
    return (
      <section className={styles.errorCard}>
        <LoadError message={loadErrorMessage(failedQuery) ?? LOAD_FAILED_TEXT} />
        <RefreshButton query={failedQuery} label="loại đơn" />
      </section>
    );
  }

  // Loại đơn vừa tạo có thể chưa có trong danh sách (đang tải lại): chưa có đơn nào
  const formCount = formTypes.find((formType) => formType.id === formTypeId)?.formCount ?? 0;
  return <FormTypeEditor savedFormType={savedFormType} formCount={formCount} />;
}

/**
 * Đổi bản soạn thành dữ liệu gửi lên máy chủ: bỏ khoảng trắng thừa ở tên, mô tả; mô tả trống thành null.
 * @param draft  bản soạn
 * @returns      body của POST / PUT loại đơn
 */
function toSaveRequest(draft: FormTypeDraft): SaveFormTypeRequest {
  return {
    name: draft.name.trim(),
    prefix: draft.prefix,
    description: draft.description.trim() || null,
    status: draft.status,
    sections: draft.sections,
  };
}

/**
 * Đưa con trỏ tới ô lỗi đầu tiên trong trình soạn; không có ô nào (lỗi chung) thì cuộn tới khung báo lỗi.
 * Gọi sau khi giao diện đã vẽ lại với các ô lỗi.
 */
function focusFirstIssue(): void {
  const firstInvalid = document.querySelector<HTMLElement>('#editor-panel-edit [aria-invalid="true"]');
  if (firstInvalid) {
    firstInvalid.scrollIntoView({ block: 'center', behavior: 'smooth' });
    firstInvalid.focus({ preventScroll: true });
    return;
  }
  document.getElementById('editor-issues')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
}

interface FormTypeEditorProps {
  /** Loại đơn đã lưu; tạo mới thì null */
  savedFormType: FormType | null;
  /** Số đơn đã nộp theo loại này: có đơn thì khóa mã đơn, không xóa được, hiện câu lưu ý */
  formCount: number;
}

/**
 * Trình soạn một loại đơn: giữ bản đang soạn, sửa gì cũng đánh dấu "Chưa lưu"; bấm Lưu thì kiểm tra rồi gửi lên máy chủ.
 * @param props  xem FormTypeEditorProps
 * @returns      tiêu đề, tab, khung báo lỗi, thẻ thông tin, các phần, hàng nút cuối, hộp xác nhận xóa
 */
function FormTypeEditor({ savedFormType, formCount }: FormTypeEditorProps) {
  const draftKey = savedFormType?.id ?? NEW_FORM_TYPE_ID;
  const isNew = !savedFormType;
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const saveFormType = useSaveFormType(savedFormType?.id ?? null);
  const deleteFormType = useDeleteFormType(draftKey);
  const formTypesQuery = useFormTypes();

  // Bản đang soạn: lấy bản chưa lưu đã giữ (nếu có), không thì từ loại đơn đã lưu hoặc bản trống
  const [draft, setDraft] = useState(() => readFormTypeDraft(draftKey) ?? (savedFormType ? draftFromFormType(savedFormType) : newFormTypeDraft()));
  const [dirty, setDirty] = useState(() => readFormTypeDraft(draftKey) !== undefined);
  const [editorMode, setEditorMode] = useState<EditorMode>('edit');
  // Phần / câu hỏi vừa thêm: đưa con trỏ vào ô đầu tiên của nó
  const [focusTarget, setFocusTarget] = useState<{ sectionId: string | null; questionId: string | null }>({ sectionId: null, questionId: null });
  // Đã bấm Lưu mà còn lỗi: từ đó kiểm tra lại mỗi lần sửa, sửa hết lỗi thì khung báo lỗi tự ẩn
  const [showIssues, setShowIssues] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // Giữ bản chưa lưu để đi trang khác rồi quay lại vẫn còn
  useEffect(() => {
    if (dirty) keepFormTypeDraft(draftKey, draft);
  }, [draftKey, draft, dirty]);

  // Lỗi của bản soạn (chỉ sau khi đã bấm Lưu); mã đơn so với các loại đơn khác trong danh sách đã tải
  const otherPrefixes = useMemo(
    () => (formTypesQuery.data ?? []).filter((formType) => formType.id !== savedFormType?.id).map((formType) => formType.prefix),
    [formTypesQuery.data, savedFormType?.id],
  );
  const issues = useMemo(() => (showIssues ? validateFormTypeDraft(draft, otherPrefixes) : []), [showIssues, draft, otherPrefixes]);
  const invalidTargets = useMemo(() => new Set(issues.flatMap((issue) => (issue.target ? [issue.target] : []))), [issues]);

  /**
   * Đổi bản soạn và đánh dấu chưa lưu.
   * @param changeDraft  hàm nhận bản cũ, trả bản mới
   */
  const editDraft = (changeDraft: (current: FormTypeDraft) => FormTypeDraft) => {
    setDraft(changeDraft);
    setDirty(true);
  };
  const setSections = (changeSections: (sections: FormSection[]) => FormSection[]) =>
    editDraft((current) => ({ ...current, sections: changeSections(current.sections) }));

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

  /**
   * Chuyển giữa Soạn và Xem trước, về đầu trang.
   * Bỏ đích đưa con trỏ, để quay lại tab Soạn không nhảy về ô vừa thêm lần trước.
   * @param mode  chế độ muốn mở
   */
  const changeEditorMode = (mode: EditorMode) => {
    setEditorMode(mode);
    setFocusTarget({ sectionId: null, questionId: null });
    window.scrollTo({ top: 0 });
  };

  /** Thêm phần mới ở cuối (có sẵn một câu hỏi trống), đưa con trỏ vào ô tiêu đề phần. */
  const addSection = () => {
    const section = newSection();
    setSections((sections) => [...sections, section]);
    setFocusTarget({ sectionId: section.id, questionId: null });
  };

  /**
   * Lưu: về tab Soạn, kiểm tra bản soạn; còn lỗi thì tô đỏ, liệt kê lỗi, đưa con trỏ tới ô lỗi đầu tiên.
   * Hợp lệ thì gửi lên máy chủ: tạo mới xong thì chuyển sang trình soạn của loại đơn vừa tạo; lưu đè xong thì soạn tiếp từ bản đã lưu.
   */
  const save = () => {
    // Kiểm tra trước khi gửi
    setEditorMode('edit');
    setShowIssues(true);
    if (validateFormTypeDraft(draft, otherPrefixes).length) {
      setTimeout(focusFirstIssue);
      return;
    }

    // Gửi lên máy chủ
    saveFormType.mutate(toSaveRequest(draft), {
      onSuccess: (savedType) => {
        discardFormTypeDraft(draftKey);
        toast(FORM_TYPE_MESSAGES.saved(savedType.name, FORM_TYPE_STATUS_LABEL[savedType.status]), 'success');
        if (isNew) {
          navigate(formTypeEditorPath(savedType.id), { replace: true, state: location.state });
          return;
        }
        setDraft(draftFromFormType(savedType));
        setDirty(false);
        setShowIssues(false);
      },
      onError: (error) => toast(error.message, 'error'),
    });
  };

  /** Bỏ thay đổi: soạn lại từ loại đơn đã lưu. */
  const discardChanges = () => {
    if (!savedFormType) return;
    discardFormTypeDraft(draftKey);
    setDraft(draftFromFormType(savedFormType));
    setDirty(false);
    setShowIssues(false);
    toast(FORM_TYPE_MESSAGES.discarded, 'info');
  };

  /** Xóa loại đơn (đã xác nhận): xong thì về trang Quản lí loại đơn. */
  const removeFormType = () => {
    if (!savedFormType) return;
    deleteFormType.mutate(undefined, {
      onSuccess: () => {
        discardFormTypeDraft(draftKey);
        toast(FORM_TYPE_MESSAGES.deleted(savedFormType.name), 'success');
        navigate(PAGE_PATH.formTypes, { replace: true });
      },
      onError: (error) => {
        setConfirmingDelete(false);
        toast(error.message, 'error');
      },
    });
  };

  return (
    <DraftIssuesContext.Provider value={invalidTargets}>
      <div className={styles.head}>
        <h1 className={styles.title}>{isNew ? 'Tạo loại đơn' : `Soạn loại đơn ${savedFormType.name}`}</h1>
        <div className={styles.headActions}>
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

      {/* Các lỗi của bản soạn, cập nhật ngay khi sửa; sửa hết thì ẩn */}
      {issues.length > 0 && (
        <div id="editor-issues" className={styles.issues} role="alert">
          <p>Chưa lưu được. Kiểm tra lại:</p>
          <ul>
            {issueMessages(issues).map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Xem trước: dựng lại mỗi lần mở tab, nên luôn theo bản đang soạn và câu trả lời thử bắt đầu từ trống */}
      {editorMode === 'preview' && (
        <div id="editor-panel-preview" role="tabpanel" aria-labelledby="editor-tab-preview">
          <FormTypePreview draft={draft} />
        </div>
      )}

      {/* Soạn: chỉ ẩn khi xem trước, không bỏ khỏi trang */}
      <div id="editor-panel-edit" role="tabpanel" aria-labelledby="editor-tab-edit" className={styles.editor} hidden={editorMode !== 'edit'}>
        {formCount > 0 && (
          <p className={styles.formsNotice}>
            <b>Đã có {formCount} đơn loại này.</b> Các đơn đã nộp giữ nguyên nội dung lúc nộp; thay đổi chỉ áp dụng cho đơn nộp sau khi lưu. Mã
            đơn không đổi được nữa.
          </p>
        )}
        <FormTypeInfoCard
          draft={draft}
          prefixLocked={formCount > 0}
          draftLocked={!canChooseDraftStatus(savedFormType?.status ?? null)}
          onChange={(changes) => editDraft((current) => ({ ...current, ...changes }))}
        />
        {draft.sections.map((section, index) => (
          <SectionEditor
            key={section.id}
            section={section}
            index={index}
            sectionCount={draft.sections.length}
            focusQuestionId={focusTarget.questionId}
            autoFocus={section.id === focusTarget.sectionId}
            onChange={(nextSection) => setSections((sections) => replaceAt(sections, index, nextSection))}
            onAction={(action) => actOnSection(index, action)}
            onQuestionAdded={(questionId) => setFocusTarget({ sectionId: null, questionId })}
          />
        ))}
        <div className={styles.bottom}>
          <Button onClick={addSection}>+ Thêm phần</Button>
          <span className={styles.spacer} />
          {dirty && !isNew && <Button onClick={discardChanges}>Bỏ thay đổi</Button>}
          {!isNew && formCount === 0 && (
            <Button variant="danger" onClick={() => setConfirmingDelete(true)}>
              Xóa loại đơn
            </Button>
          )}
          <Button variant="primary" onClick={save} disabled={saveFormType.isPending}>
            {saveFormType.isPending ? 'Đang lưu…' : 'Lưu'}
          </Button>
        </div>
      </div>

      {/* Xác nhận xóa loại đơn */}
      <Modal open={confirmingDelete} onClose={() => !deleteFormType.isPending && setConfirmingDelete(false)} title={`Xóa loại đơn ${savedFormType?.name ?? ''}?`}>
        <p className={styles.hint}>Loại đơn này chưa có đơn nào. Xóa rồi thì không lấy lại được.</p>
        <div className={styles.dialogButtons}>
          <Button variant="ghost" onClick={() => setConfirmingDelete(false)} disabled={deleteFormType.isPending}>
            Hủy
          </Button>
          <Button variant="danger" onClick={removeFormType} disabled={deleteFormType.isPending}>
            {deleteFormType.isPending ? 'Đang xóa…' : 'Xóa loại đơn'}
          </Button>
        </div>
      </Modal>
    </DraftIssuesContext.Provider>
  );
}
