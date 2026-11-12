/* Trang nộp đơn mới của một loại đơn, mở sau khi chọn trong hộp "Chọn loại đơn":
   - đơn của mình: #/nop-don/<mã loại đơn>, mở từ trang Thông tin cá nhân;
   - nộp thay (Admin): #/ho-so/<id người nộp đơn>/nop-don/<mã loại đơn>, mở từ trang thông tin người đó.
   Gồm: nội dung đơn theo cấu trúc loại đơn, khung "Thông tin đơn" bên phải, hàng nút dính đáy có ô cam đoan.
   Gửi đơn: gửi câu trả lời và mọi tệp trong một lần; xong thì về trang thông tin của người nộp đơn, đơn mới nằm trong "Đơn đã nộp". */
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useNavigationType, useParams } from 'react-router';
import { FORM_MESSAGES, type FormType } from '@ulaw/shared';
import { useFormType } from '../../api/form-types';
import { useMyProfile, usePersonProfile } from '../../api/profile';
import { PAGE_LABEL, PAGE_PATH, PERSON_PROFILE_LABEL, personProfilePath, type ReturnState } from '../../app/paths';
import { Button } from '../../components/Button';
import { LoadError, loadErrorMessage } from '../../components/LoadError';
import { RefreshButton } from '../../components/RefreshButton';
import { useToast } from '../../components/Toast';
import { useAuth } from '../../features/auth/useAuth';
import { FormSections } from '../../features/form-renderer/FormSections';
import { discardNewFormDraft, keepNewFormDraft, readNewFormDraft } from '../../features/form-renderer/newFormDrafts';
import { useFormAnswers } from '../../features/form-renderer/useFormAnswers';
import { useSubmitNewForm } from '../../features/form-renderer/useSubmitNewForm';
import { SHOW_DEMO } from '../../lib/env';
import { FormInfoPanel, FormInfoPanelToggle, FormInfoSection, useFormInfoPanel } from './FormInfoPanel';
import styles from './FormPage.module.css';
import { SubmitBar, checkBeforeSending, useCommitment } from './SubmitBar';
import { useLeavePage } from './useLeavePage';

/** Câu báo khi không tải được loại đơn mà máy chủ không gửi kèm câu báo lỗi (vd mất mạng). */
const LOAD_FAILED_TEXT = 'Không tải được loại đơn.';

/** Câu báo khi gửi đơn lỗi mà không có câu báo nào (vd mất mạng). */
const SUBMIT_FAILED_TEXT = 'Chưa gửi được đơn. Kiểm tra kết nối mạng rồi bấm Gửi đơn lại.';

/**
 * Tải cấu trúc loại đơn rồi vẽ trang nộp đơn. Đường dẫn có id người dùng thì là nộp thay cho người đó.
 * @returns  giao diện trang: đang tải / câu báo lỗi kèm nút ↻ / lá đơn
 */
export function NewFormPage() {
  const { formTypeId = '', userId: applicantId } = useParams();
  const formTypeQuery = useFormType(formTypeId);
  const navigate = useNavigate();
  const { backLabel, goBack, previousPageLabel } = useLeavePage();

  // Gửi đơn xong: về trang thông tin của người nộp đơn (của mình: Thông tin cá nhân; nộp thay: trang người đó).
  // Trang trước chính là trang đó thì lùi lại như nút Back, không thì thay trang nộp đơn trong lịch sử,
  // để bấm Back không mở lại lá đơn đã gửi
  const [ownerPageLabel, ownerPagePath] = applicantId
    ? [PERSON_PROFILE_LABEL, personProfilePath(applicantId)]
    : [PAGE_LABEL.profile, PAGE_PATH.profile];
  const leaveAfterSubmit = () => (previousPageLabel === ownerPageLabel ? navigate(-1) : navigate(ownerPagePath, { replace: true }));

  return (
    <div className={styles.page}>
      <button type="button" className={styles.back} onClick={goBack}>
        ‹ Quay lại {backLabel}
      </button>
      {formTypeQuery.isPending ? (
        <p className={styles.muted}>Đang tải loại đơn…</p>
      ) : formTypeQuery.data ? (
        <NewForm
          key={`${formTypeQuery.data.id}@${applicantId ?? ''}`}
          formType={formTypeQuery.data}
          applicantId={applicantId}
          onCancel={goBack}
          onSubmitted={leaveAfterSubmit}
        />
      ) : (
        <section className={styles.errorCard}>
          <LoadError message={loadErrorMessage(formTypeQuery) ?? LOAD_FAILED_TEXT} />
          <RefreshButton query={formTypeQuery} label="loại đơn" />
        </section>
      )}
    </div>
  );
}

/**
 * Lá đơn mới: tiêu đề, các phần câu hỏi, khung "Thông tin đơn", hàng nút có ô cam đoan.
 * Bấm Gửi đơn: kiểm tra mọi câu và ô cam đoan; lỗi thì báo dưới từng câu và bằng toast, đưa con trỏ tới chỗ lỗi đầu tiên.
 * Hợp lệ thì gửi lên máy chủ; xong thì bỏ nháp, báo mã đơn mới và rời trang.
 * Quay lại trang này bằng nút Quay lại / Back (vd từ "Xem hồ sơ ›") thì giữ câu đã điền; mở bằng "Nộp đơn mới" thì đơn trống.
 * Nháp giữ riêng theo loại đơn và người nộp đơn (nộp thay cho hai người khác nhau không lẫn nháp).
 * @param formType     loại đơn đủ cấu trúc
 * @param applicantId  nộp thay: id người nộp đơn; bỏ trống = đơn của mình
 * @param onCancel     bấm Hủy: rời trang
 * @param onSubmitted  gửi đơn xong: rời trang
 * @returns            thẻ <form>
 */
function NewForm({
  formType,
  applicantId,
  onCancel,
  onSubmitted,
}: {
  formType: FormType;
  applicantId?: string;
  onCancel: () => void;
  onSubmitted: () => void;
}) {
  const toast = useToast();
  const submitNewForm = useSubmitNewForm(formType, applicantId);
  const applicantQuery = usePersonProfile(applicantId ?? '', !!applicantId);
  const infoPanel = useFormInfoPanel();
  const navigationType = useNavigationType();
  const draftKey = applicantId ? `${formType.id}@${applicantId}` : formType.id;
  const [savedDraft] = useState(() => (navigationType === 'POP' ? readNewFormDraft(draftKey) : undefined));
  const { answers, setAnswer, questionErrors, validate } = useFormAnswers(formType.sections, savedDraft?.answers);
  const commitment = useCommitment(savedDraft?.committed ?? false);
  const { committed } = commitment;
  const [previewReadOnly, setPreviewReadOnly] = useState(false);

  // Giữ nháp mỗi khi đổi câu trả lời hoặc ô cam đoan, để rời trang rồi quay lại vẫn còn
  useEffect(() => keepNewFormDraft(draftKey, { answers, committed }), [draftKey, answers, committed]);

  /**
   * Bấm Gửi đơn. Còn lỗi thì báo (xem checkBeforeSending); hợp lệ thì gửi lên máy chủ (đang gửi thì bỏ qua lần bấm thêm).
   * @param event  sự kiện gửi form (chặn để trang không tải lại)
   */
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitNewForm.isPending || !checkBeforeSending(validate, commitment, toast)) return;

    // Hợp lệ: gửi lên máy chủ; xong thì bỏ nháp, rời trang, báo mã đơn (nộp thay thì kèm tên người nộp đơn)
    submitNewForm.mutate(
      { answers, committed },
      {
        onSuccess: (newForm) => {
          discardNewFormDraft(draftKey);
          onSubmitted();
          const applicantName = applicantQuery.data?.name;
          toast(applicantName ? FORM_MESSAGES.submittedFor(newForm.code, applicantName) : FORM_MESSAGES.submitted(newForm.code), 'success');
        },
        onError: (error) => toast(error.message || SUBMIT_FAILED_TEXT, 'error'),
      },
    );
  };

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      <div className={styles.head}>
        <div className={styles.headText}>
          <h1 className={styles.title}>{formType.name}</h1>
          {formType.description && <p className={styles.muted}>{formType.description}</p>}
        </div>
        <FormInfoPanelToggle panel={infoPanel} />
      </div>

      {/* JUST FOR DEMO: START · xem thử dạng chỉ xem của lá đơn (như ở trang chi tiết đơn đã khóa), chỉ hiện khi VITE_APP_ENV = "dev" */}
      {SHOW_DEMO && (
        <label className={styles.demoToggle}>
          <input type="checkbox" checked={previewReadOnly} onChange={(event) => setPreviewReadOnly(event.target.checked)} />
          Xem thử dạng chỉ xem
        </label>
      )}
      {/* JUST FOR DEMO: END */}

      <div className={`${styles.grid} ${!infoPanel.isNarrow && infoPanel.isOpen ? styles.withSide : ''}`}>
        {/* cột nội dung đơn: hàng nút nằm trong cột này nên rộng bằng lá đơn, không chạy sang dưới khung Thông tin đơn */}
        <div className={styles.main}>
          <FormSections
            sections={formType.sections}
            answers={answers}
            onAnswerChange={setAnswer}
            questionErrors={questionErrors}
            readOnly={previewReadOnly}
          />

          {!previewReadOnly && (
            <SubmitBar commitment={commitment}>
              <Button variant="ghost" onClick={onCancel} disabled={submitNewForm.isPending}>
                Hủy
              </Button>
              <Button variant="primary" type="submit" disabled={submitNewForm.isPending}>
                {submitNewForm.isPending ? 'Đang gửi…' : 'Gửi đơn'}
              </Button>
            </SubmitBar>
          )}
        </div>
        <FormInfoPanel panel={infoPanel}>
          {applicantId ? (
            <OtherApplicantInfo applicantId={applicantId} name={applicantQuery.data?.name} email={applicantQuery.data?.email} />
          ) : (
            <ApplicantInfo />
          )}
        </FormInfoPanel>
      </div>
    </form>
  );
}

/**
 * Mục "Người nộp đơn" trong khung Thông tin đơn: họ tên, email và liên kết sang trang Thông tin cá nhân
 * (ở đó có nút "‹ Quay lại đơn đang soạn", quay về vẫn còn câu đã điền).
 * Họ tên lấy từ hồ sơ (vừa sửa ở trang Thông tin cá nhân thì thấy ngay), chưa tải xong thì lấy từ phiên đăng nhập.
 * @returns  khối mục
 */
function ApplicantInfo() {
  const { user } = useAuth();
  const profileQuery = useMyProfile();
  return (
    <FormInfoSection
      title="Người nộp đơn"
      action={
        <Link to={PAGE_PATH.profile} state={{ previousPageLabel: 'đơn đang soạn' } satisfies ReturnState}>
          Xem hồ sơ ›
        </Link>
      }
      rows={[
        ['Họ và tên', profileQuery.data?.name ?? user.name],
        ['Email', user.email],
      ]}
    />
  );
}

/**
 * Mục "Người nộp đơn" khi nộp thay: họ tên, email của người đó và liên kết sang trang thông tin của họ
 * (ở đó có nút "‹ Quay lại đơn đang soạn", quay về vẫn còn câu đã điền).
 * @param applicantId  id người nộp đơn
 * @param name         họ tên (chưa tải xong thì "Đang tải…")
 * @param email        email (chưa tải xong thì "Đang tải…")
 * @returns            khối mục
 */
function OtherApplicantInfo({ applicantId, name, email }: { applicantId: string; name?: string; email?: string }) {
  return (
    <FormInfoSection
      title="Người nộp đơn"
      action={
        <Link to={personProfilePath(applicantId)} state={{ previousPageLabel: 'đơn đang soạn' } satisfies ReturnState}>
          Xem hồ sơ ›
        </Link>
      }
      rows={[
        ['Họ và tên', name ?? 'Đang tải…'],
        ['Email', email ?? 'Đang tải…'],
      ]}
    />
  );
}
