/* Trang chi tiết một lá đơn (#/don/<mã đơn>), như openDetail() trong artifact/js/application-form.js.
   Gồm: tiêu đề, khung thông báo theo trạng thái, nội dung đơn, khung "Thông tin đơn" bên phải
   (trạng thái, ngày nộp, người nộp đơn, người tiếp nhận, người xử lí).
   Nội dung đơn sửa được khi canEditForm (đơn của mình hoặc Admin, đơn Đã nộp / Cần bổ sung / Đã bổ sung), còn lại chỉ xem.
   Cán bộ có quyền receive thấy nút "Tiếp nhận" ở đầu trang khi đơn Đã nộp / Đã bổ sung.
   Đơn Đang xét mà mình được ra quyết định (canDecideOn) thì có hàng nút Yêu cầu bổ sung / Từ chối / Duyệt ở đáy trang.
   Lịch sử: thêm ở phần sau của bước 5. */
import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router';
import { FORM_MESSAGES, canDecideOn, canEditForm, canReceiveForm, canTransferForm, type FormDetail, type FormStatus } from '@ulaw/shared';
import { useFormDetail, useReceiveForm } from '../../api/forms';
import { PAGE_PATH, type ReturnState } from '../../app/paths';
import { Button } from '../../components/Button';
import { LoadError, loadErrorMessage } from '../../components/LoadError';
import { RefreshButton } from '../../components/RefreshButton';
import { StatusPill } from '../../components/StatusPill';
import { useToast } from '../../components/Toast';
import { useAuth } from '../../features/auth/useAuth';
import { FormSections } from '../../features/form-renderer/FormSections';
import { answersChanged } from '../../features/form-renderer/formAnswers';
import { useFormAnswers } from '../../features/form-renderer/useFormAnswers';
import { useSaveFormChanges } from '../../features/form-renderer/useSaveFormChanges';
import { EMPTY_TEXT, formatDateTime } from '../../lib/format';
import { DecideBar } from './DecideBar';
import { FormInfoPanel, FormInfoPanelToggle, FormInfoSection, useFormInfoPanel } from './FormInfoPanel';
import styles from './FormPage.module.css';
import { TransferDialog } from './TransferDialog';
import { SubmitBar, checkBeforeSending, useCommitment } from './SubmitBar';
import { useLeavePage } from './useLeavePage';

/** Câu báo khi không tải được đơn mà máy chủ không gửi kèm câu báo lỗi (vd mất mạng). */
const LOAD_FAILED_TEXT = 'Không tải được đơn.';

/** Câu báo khi lưu thay đổi lỗi mà không có câu báo nào (vd mất mạng). */
const SAVE_FAILED_TEXT = 'Chưa lưu được thay đổi. Kiểm tra kết nối mạng rồi bấm Lưu thay đổi lại.';

/** Câu báo khi tiếp nhận lỗi mà không có câu báo nào (vd mất mạng). */
const RECEIVE_FAILED_TEXT = 'Chưa tiếp nhận được đơn. Kiểm tra kết nối mạng rồi bấm Tiếp nhận lại.';

/* Câu thông báo theo trạng thái (như STATUS_MSG của bản mẫu, xem "Câu thông báo trên trang chi tiết đơn" trong artifact/README.md).
   Giống nhau với mọi vai trò, không đổi theo người xem. */
const STATUS_NOTICE: Record<FormStatus, (form: FormDetail) => string> = {
  nop: () =>
    'Đơn đã được gửi, đang chờ phòng Đào tạo tiếp nhận. Người nộp đơn được quyền chỉnh sửa đến khi đơn được tiếp nhận.',
  xet: () => 'Phòng Đào tạo đang xét đơn.',
  bs: () => 'Phòng Đào tạo yêu cầu bổ sung hồ sơ. Sau khi người nộp đơn sửa và lưu, đơn chuyển sang “Đã bổ sung”.',
  bsg: (form) =>
    `Người nộp đơn đã bổ sung lúc ${formatDateTime(form.updatedAt)}, đang chờ phòng Đào tạo tiếp nhận lại. ` +
    'Người nộp đơn được quyền chỉnh sửa đến khi đơn được tiếp nhận.',
  duyet: () => 'Đơn đã được duyệt.',
  tc: () => 'Đơn đã bị từ chối.',
};

/**
 * Tải lá đơn theo mã trên đường dẫn rồi vẽ trang chi tiết.
 * @returns  giao diện trang: đang tải / câu báo lỗi kèm nút ↻ / lá đơn
 */
export function FormDetailPage() {
  const { code = '' } = useParams();
  const formQuery = useFormDetail(code);
  const { backLabel, goBack } = useLeavePage();

  return (
    <div className={styles.page}>
      <button type="button" className={styles.back} onClick={goBack}>
        ‹ Quay lại {backLabel}
      </button>
      {formQuery.isPending ? (
        <p className={styles.muted}>Đang tải đơn…</p>
      ) : formQuery.data ? (
        <FormDetailView form={formQuery.data} onLeave={goBack} />
      ) : (
        <section className={styles.errorCard}>
          <LoadError message={loadErrorMessage(formQuery) ?? LOAD_FAILED_TEXT} />
          <RefreshButton query={formQuery} label="đơn" />
        </section>
      )}
    </div>
  );
}

/**
 * Nội dung trang chi tiết của một lá đơn đã tải.
 * @param form     lá đơn đủ nội dung
 * @param onLeave  rời trang (nút Hủy thay đổi)
 * @returns        tiêu đề, khung thông báo, nội dung đơn (sửa được hoặc chỉ xem) và khung Thông tin đơn
 */
function FormDetailView({ form, onLeave }: { form: FormDetail; onLeave: () => void }) {
  const infoPanel = useFormInfoPanel();
  const { user, role } = useAuth();
  const editable = canEditForm({ id: user.id, role }, { status: form.status, applicantId: form.applicant.id });
  const [savedCount, setSavedCount] = useState(0);
  const [transferOpen, setTransferOpen] = useState(false);

  return (
    <div className={styles.form}>
      <div className={styles.head}>
        <div className={styles.headText}>
          <h1 className={styles.title}>Chi tiết đơn {form.code}</h1>
        </div>
        <div className={styles.headActions}>
          <FormInfoPanelToggle panel={infoPanel} />
          {canReceiveForm(role, form.status) && <ReceiveButton form={form} />}
        </div>
      </div>

      <StatusNotice form={form} />

      <div className={`${styles.grid} ${!infoPanel.isNarrow && infoPanel.isOpen ? styles.withSide : ''}`}>
        {editable ? (
          // Mỗi lần lưu xong thì vẽ lại từ lá đơn mới (câu trả lời, tệp có id ở máy chủ, bỏ đánh dấu cam đoan)
          <FormEditor key={savedCount} form={form} onCancel={onLeave} onSaved={() => setSavedCount((count) => count + 1)} />
        ) : (
          <div className={styles.main}>
            <FormSections sections={form.sections} answers={form.answers} readOnly />
            {canDecideOn({ email: user.email, role }, form) && <DecideBar form={form} />}
          </div>
        )}
        <FormInfoPanel panel={infoPanel}>
          <FormInfoSection
            shaded
            rows={[
              ['Trạng thái', <StatusPill status={form.status} />],
              ['Loại đơn', form.formTypeName],
              ['Nộp lúc', formatDateTime(form.submittedAt)],
              ['Cập nhật lúc', formatDateTime(form.updatedAt)],
            ]}
          />
          <ApplicantInfo form={form} />
          {form.receiver && (
            <FormInfoSection
              title="Người tiếp nhận"
              rows={[
                ['Họ và tên', form.receiver.name],
                ['Tiếp nhận lúc', form.receivedAt ? formatDateTime(form.receivedAt) : EMPTY_TEXT],
              ]}
            />
          )}
          {form.handler && (
            <FormInfoSection
              title="Người xử lí"
              action={canTransferForm(role, form) && <button type="button" onClick={() => setTransferOpen(true)}>Chuyển giao</button>}
              rows={[
                ['Họ và tên', form.handler.name],
                ['Phụ trách từ', form.handlerSince ? formatDateTime(form.handlerSince) : EMPTY_TEXT],
              ]}
            />
          )}
        </FormInfoPanel>
      </div>
      <TransferDialog form={form} open={transferOpen} onClose={() => setTransferOpen(false)} />
    </div>
  );
}

/**
 * Nội dung đơn sửa được (như openDetail với editable của bản mẫu): các phần câu hỏi, hàng nút có ô cam đoan,
 * "Hủy thay đổi" (rời trang) và "Lưu thay đổi".
 * Bấm Lưu thay đổi: chưa sửa gì thì báo không có thay đổi; còn lỗi thì báo như lúc nộp đơn;
 * hợp lệ thì gửi câu trả lời và tệp mới lên máy chủ trong một lần.
 * Lưu xong: đơn Cần bổ sung chuyển sang Đã bổ sung; toast ghi giờ lưu.
 * @param form      lá đơn đang sửa
 * @param onCancel  bấm Hủy thay đổi
 * @param onSaved   lưu xong (lá đơn mới đã có trong cache): trang vẽ lại khung sửa từ lá đơn mới
 * @returns         thẻ <form> chiếm cột nội dung đơn
 */
function FormEditor({ form, onCancel, onSaved }: { form: FormDetail; onCancel: () => void; onSaved: () => void }) {
  const toast = useToast();
  const saveChanges = useSaveFormChanges(form);
  const { answers, setAnswer, questionErrors, validate } = useFormAnswers(form.sections, form.answers);
  const commitment = useCommitment();

  /**
   * Bấm Lưu thay đổi (đang lưu thì bỏ qua lần bấm thêm).
   * @param event  sự kiện gửi form (chặn để trang không tải lại)
   */
  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saveChanges.isPending) return;

    // Chưa sửa gì: không gửi
    if (!answersChanged(form.sections, form.answers, answers)) {
      toast(FORM_MESSAGES.noChanges, 'info');
      return;
    }
    if (!checkBeforeSending(validate, commitment, toast)) return;

    // Gửi lên máy chủ; xong thì báo giờ lưu (đơn Cần bổ sung báo đã chuyển sang Đã bổ sung)
    saveChanges.mutate(
      { answers, committed: commitment.committed },
      {
        onSuccess: (savedForm) => {
          const timeText = formatDateTime(savedForm.updatedAt);
          const supplemented = form.status === 'bs' && savedForm.status === 'bsg';
          toast(supplemented ? FORM_MESSAGES.supplemented(timeText) : FORM_MESSAGES.saved(timeText), 'success');
          onSaved();
        },
        onError: (error) => toast(error.message || SAVE_FAILED_TEXT, 'error'),
      },
    );
  };

  return (
    <form className={styles.main} onSubmit={save} noValidate>
      <FormSections sections={form.sections} answers={answers} onAnswerChange={setAnswer} questionErrors={questionErrors} />
      <SubmitBar commitment={commitment}>
        <Button variant="ghost" onClick={onCancel} disabled={saveChanges.isPending}>
          Hủy thay đổi
        </Button>
        <Button variant="primary" type="submit" disabled={saveChanges.isPending}>
          {saveChanges.isPending ? 'Đang lưu…' : 'Lưu thay đổi'}
        </Button>
      </SubmitBar>
    </form>
  );
}

/**
 * Nút "Tiếp nhận" ở đầu trang (như #fReceive của bản mẫu). Bấm thì đơn chuyển sang Đang xét,
 * mình thành người tiếp nhận và người xử lí; trang vẽ lại theo lá đơn mới, toast ghi giờ tiếp nhận.
 * @param form  lá đơn đang chờ tiếp nhận
 * @returns     nút bấm; đang gửi thì khóa nút
 */
function ReceiveButton({ form }: { form: FormDetail }) {
  const toast = useToast();
  const receive = useReceiveForm(form.code);

  /** Bấm Tiếp nhận: gửi lên máy chủ, xong thì báo giờ tiếp nhận; lỗi thì báo câu máy chủ gửi. */
  const receiveForm = () =>
    receive.mutate(undefined, {
      onSuccess: (receivedForm) =>
        toast(FORM_MESSAGES.received(receivedForm.code, formatDateTime(receivedForm.receivedAt ?? receivedForm.updatedAt)), 'success'),
      onError: (error) => toast(error.message || RECEIVE_FAILED_TEXT, 'error'),
    });

  return (
    <Button variant="primary" className={styles.headButton} onClick={receiveForm} disabled={receive.isPending}>
      {receive.isPending ? 'Đang tiếp nhận…' : 'Tiếp nhận'}
    </Button>
  );
}

/**
 * Khung thông báo dưới tiêu đề: một câu cố định theo trạng thái, màu nền theo trạng thái,
 * kèm dòng "Phòng Đào tạo: <lí do>" khi cán bộ có ghi lí do (Yêu cầu bổ sung / Từ chối).
 * @param form  lá đơn
 * @returns     khung thông báo, được đọc cho trình đọc màn hình như một vùng trạng thái
 */
function StatusNotice({ form }: { form: FormDetail }) {
  return (
    <div className={`${styles.notice} ${styles[`notice_${form.status}`] ?? ''}`} role="status">
      <p>{STATUS_NOTICE[form.status](form)}</p>
      {form.note && (
        <p>
          <b>Phòng Đào tạo:</b> {form.note}
        </p>
      )}
    </div>
  );
}

/**
 * Mục "Người nộp đơn" trong khung Thông tin đơn: họ tên, email.
 * Đơn của mình thì có liên kết "Xem hồ sơ ›" sang trang Thông tin cá nhân (ở đó có nút quay lại đơn này).
 * Trang thông tin của người nộp đơn khác chưa có (làm ở bước Quản lí tài khoản), nên đơn người khác chưa có liên kết.
 * @param form  lá đơn
 * @returns     khối mục
 */
function ApplicantInfo({ form }: { form: FormDetail }) {
  const { user } = useAuth();
  const isMine = form.applicant.id === user.id;
  return (
    <FormInfoSection
      title="Người nộp đơn"
      action={
        isMine && (
          <Link to={PAGE_PATH.profile} state={{ previousPageLabel: `đơn ${form.code}` } satisfies ReturnState}>
            Xem hồ sơ ›
          </Link>
        )
      }
      rows={[
        ['Họ và tên', form.applicant.name],
        ['Email', form.applicant.email],
      ]}
    />
  );
}
