/* Trình soạn loại đơn (#/soan-don/<mã loại đơn>, tạo mới: #/soan-don/moi), như phần "Trình soạn" của artifact/js/forms-page.js.
   Gồm: nút quay lại, tiêu đề, tab Soạn / Xem trước, nhãn "Chưa lưu", thẻ Thông tin loại đơn, các phần và câu hỏi, nút "+ Thêm phần".
   Lưu (kiểm tra, gửi lên máy chủ, Bỏ thay đổi, Xóa loại đơn) làm ở phần sau. */
import { useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';
import type { FormSection } from '@ulaw/shared';
import { useFormType } from '../../api/form-types';
import { NEW_FORM_TYPE_ID, PAGE_LABEL, PAGE_PATH, readPreviousPageLabel } from '../../app/paths';
import { Button } from '../../components/Button';
import { LoadError, loadErrorMessage } from '../../components/LoadError';
import { RefreshButton } from '../../components/RefreshButton';
import { FormTypeInfoCard } from './FormTypeInfoCard';
import { FormTypePreview } from './FormTypePreview';
import { draftFromFormType, moveItem, newFormTypeDraft, newSection, removeAt, replaceAt, type FormTypeDraft } from './formTypeDraft';
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
      {isNew ? <FormTypeEditor key="new" initialDraft={newFormTypeDraft()} isNew /> : <SavedFormTypeEditor formTypeId={formTypeId} />}
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
 * Tải loại đơn đã lưu rồi mở trình soạn.
 * @param formTypeId  mã loại đơn
 * @returns           đang tải / câu báo lỗi kèm nút ↻ / trình soạn
 */
function SavedFormTypeEditor({ formTypeId }: { formTypeId: string }) {
  const formTypeQuery = useFormType(formTypeId);
  if (formTypeQuery.isPending) return <p className={styles.muted}>Đang tải loại đơn…</p>;
  if (!formTypeQuery.data) {
    return (
      <section className={styles.errorCard}>
        <LoadError message={loadErrorMessage(formTypeQuery) ?? LOAD_FAILED_TEXT} />
        <RefreshButton query={formTypeQuery} label="loại đơn" />
      </section>
    );
  }
  return <FormTypeEditor key={formTypeId} initialDraft={draftFromFormType(formTypeQuery.data)} isNew={false} />;
}

/**
 * Trình soạn một loại đơn: giữ bản đang soạn, sửa gì cũng đánh dấu "Chưa lưu".
 * @param initialDraft  bản soạn ban đầu (loại đơn đã lưu, hoặc bản trống khi tạo mới)
 * @param isNew         đang tạo loại đơn mới
 * @returns             tiêu đề, thẻ thông tin, các phần, hàng nút cuối
 */
function FormTypeEditor({ initialDraft, isNew }: { initialDraft: FormTypeDraft; isNew: boolean }) {
  const [draft, setDraft] = useState(initialDraft);
  const [dirty, setDirty] = useState(false);
  const [editorMode, setEditorMode] = useState<EditorMode>('edit');
  // Phần / câu hỏi vừa thêm: đưa con trỏ vào ô đầu tiên của nó
  const [focusTarget, setFocusTarget] = useState<{ sectionId: string | null; questionId: string | null }>({ sectionId: null, questionId: null });

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

  return (
    <>
      <div className={styles.head}>
        <h1 className={styles.title}>{isNew ? 'Tạo loại đơn' : `Soạn loại đơn ${initialDraft.name}`}</h1>
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

      {/* Xem trước: dựng lại mỗi lần mở tab, nên luôn theo bản đang soạn và câu trả lời thử bắt đầu từ trống */}
      {editorMode === 'preview' && (
        <div id="editor-panel-preview" role="tabpanel" aria-labelledby="editor-tab-preview">
          <FormTypePreview draft={draft} />
        </div>
      )}

      {/* Soạn: chỉ ẩn khi xem trước, không bỏ khỏi trang */}
      <div id="editor-panel-edit" role="tabpanel" aria-labelledby="editor-tab-edit" className={styles.editor} hidden={editorMode !== 'edit'}>
        <FormTypeInfoCard draft={draft} onChange={(changes) => editDraft((current) => ({ ...current, ...changes }))} />
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
        </div>
      </div>
    </>
  );
}
