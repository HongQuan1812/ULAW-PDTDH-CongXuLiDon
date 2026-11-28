/* Trang chi tiết một lá đơn (#/don/<mã đơn>).
   Gồm: tiêu đề, khung thông báo theo trạng thái, nội dung đơn, khung "Thông tin đơn" bên phải
   (trạng thái, ngày nộp, hạn xử lí nếu loại đơn có hạn, người nộp đơn, người tiếp nhận, người xử lí, lịch sử).
   Nội dung đơn sửa được khi canEditForm (đơn của mình hoặc Admin, đơn Đã nộp / Cần bổ sung / Đã bổ sung), còn lại chỉ xem.
   Cán bộ có quyền receive thấy nút "Tiếp nhận" ở đầu trang khi đơn Đã nộp / Đã bổ sung.
   Đơn Đang xét mà mình được ra quyết định (canDecideOn) thì có hàng nút Yêu cầu bổ sung / Từ chối / Duyệt ở đáy trang.
   Loại đơn có mẫu xuất đơn thì có nút "Xuất đơn" ở đầu trang (điền đơn vào mẫu Word, xem trước rồi tải về).
   Cán bộ có quyền internalNotes thấy nút tròn Ghi chú nội bộ ở góc phải dưới (người nộp đơn không thấy).
   Các mục thông tin chung, người nộp đơn, người tiếp nhận, người xử lí, lịch sử thu gọn được (trình duyệt nhớ). Lịch sử cũ nhất ở trên. */
import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, useLocation, useParams } from 'react-router';
import { FORM_MESSAGES, can, canDecideOn, canEditForm, canReceiveForm, canTransferForm, deadlineDetailText, type FormDeadline, type FormDetail, type FormStatus } from '@ulaw/shared';
import { useFormDetail } from '../../api/form';
import { PAGE_PATH, personProfilePath, readOpenNotes, type ReturnState } from '../../app/paths';
import { Button } from '../../components/Button';
import { LoadError, loadErrorMessage } from '../../components/LoadError';
import { RefreshButton } from '../../components/RefreshButton';
import { DeadlinePill, StatusPill } from '../../components/StatusPill';
import { useToast } from '../../components/Toast';
import { useAuth } from '../../features/auth/useAuth';
import { FormExportButton } from '../../features/export/FormExportButton';
import { FormNotes } from '../../features/form-notes/FormNotes';
import { FormSections } from '../../features/form-renderer/FormSections';
import { answersChanged } from '../../features/form-renderer/formAnswers';
import { useFormAnswers } from '../../features/form-renderer/useFormAnswers';
import { useSaveFormChanges } from '../../features/form-renderer/useSaveFormChanges';
import { ReceiveFormButton } from '../../features/receive/ReceiveFormButton';
import { EMPTY_TEXT, formatDateTime } from '../../lib/format';
import { DecideBar } from './DecideBar';
import { FormHistory } from './FormHistory';
import { FormInfoPanel, FormInfoPanelToggle, FormInfoSection, INFO_SECTION_STORAGE_KEY, useFormInfoPanel } from './FormInfoPanel';
import styles from './FormPage.module.css';
import { TransferDialog } from './TransferDialog';
import { SubmitBar, checkBeforeSending, useCommitment } from './SubmitBar';
import { useLeavePage } from './useLeavePage';
import { BackButton } from '../../components/BackButton';

/** Câu báo khi không tải được đơn mà máy chủ không gửi kèm câu báo lỗi (vd mất mạng). */
const LOAD_FAILED_TEXT = 'Không tải được đơn.';

/** Câu báo khi lưu thay đổi lỗi mà không có câu báo nào (vd mất mạng). */
const SAVE_FAILED_TEXT = 'Chưa lưu được thay đổi. Kiểm tra kết nối mạng rồi bấm Lưu thay đổi lại.';

/* Câu thông báo theo trạng thái.
   Giống nhau với mọi vai trò, không đổi theo người xem. */
const STATUS_NOTICE: Record<FormStatus, (form: FormDetail) => ReactNode> = {
  nop: () =>
    'Đơn đã được gửi, đang chờ phòng Đào tạo tiếp nhận. Người nộp đơn được quyền chỉnh sửa đến khi đơn được tiếp nhận.',
  xet: () => 'Phòng Đào tạo đang xét đơn.',
  bs: (form) => (
    <>
      Phòng Đào tạo yêu cầu bổ sung hồ sơ<AtTime time={form.decidedAt} />. Sau khi người nộp đơn sửa và lưu, đơn chuyển sang “Đã bổ sung”.
    </>
  ),
  bsg: (form) => (
    <>
      Người nộp đơn đã bổ sung<AtTime time={form.updatedAt} />, đang chờ phòng Đào tạo tiếp nhận lại. Người nộp đơn được quyền chỉnh sửa
      đến khi đơn được tiếp nhận.
    </>
  ),
  duyet: (form) => (
    <>
      Đơn đã được duyệt<AtTime time={form.decidedAt} />.
    </>
  ),
  tc: (form) => (
    <>
      Đơn đã bị từ chối<AtTime time={form.decidedAt} />.
    </>
  ),
};

/**
 * Đoạn " lúc <giờ, ngày>" trong câu thông báo, giờ ngày tô đậm.
 * @param time  thời điểm, giờ Việt Nam 'YYYY-MM-DDTHH:mm'; null = không có
 * @returns     vd " lúc **14:05 23/11/2026**"; không có thời điểm thì không vẽ gì
 */
function AtTime({ time }: { time: string | null }) {
  if (!time) return null;
  return (
    <>
      {' lúc '}
      <b>{formatDateTime(time)}</b>
    </>
  );
}

/**
 * Hai dòng hạn xử lí ở đầu khung "Thông tin đơn": hạn (kèm thời gian xử lí tối đa), tình trạng hạn (kèm còn / trễ bao lâu).
 * @param deadline  hạn của lá đơn
 * @returns         các dòng [nhãn, giá trị]; loại đơn không giới hạn thì hạn ghi "Không giới hạn"
 */
function deadlineRows(deadline: FormDeadline): [string, ReactNode][] {
  const detail = deadlineDetailText(deadline);
  return [
    [
      'Hạn xử lí',
      deadline.maxDays === null ? (
        'Không giới hạn'
      ) : (
        <span className={styles.deadlineValue}>
          {deadline.dueAt ? formatDateTime(deadline.dueAt) : 'Chưa có, chờ bổ sung'}
          <span className={styles.deadlineNote}>Tối đa {deadline.maxDays} ngày làm việc</span>
        </span>
      ),
    ],
    [
      'Tình trạng hạn',
      <span className={styles.deadlineValue}>
        <DeadlinePill state={deadline.state} />
        {detail && <span className={styles.deadlineNote}>{detail}</span>}
      </span>,
    ],
  ];
}

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
      <BackButton label={backLabel} onClick={goBack} />
      {formQuery.isPending ? (
        <p className={styles.muted}>Đang tải đơn…</p>
      ) : formQuery.data ? (
        <FormDetailView form={formQuery.data} />
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
 * @param form  lá đơn đủ nội dung
 * @returns        tiêu đề, khung thông báo, nội dung đơn (sửa được hoặc chỉ xem) và khung Thông tin đơn
 */
function FormDetailView({ form }: { form: FormDetail }) {
  const infoPanel = useFormInfoPanel();
  const { user, role } = useAuth();
  const editable = canEditForm({ id: user.id, role }, { status: form.status, applicantId: form.applicant.id });
  const [editorKey, setEditorKey] = useState(0);
  const [transferOpen, setTransferOpen] = useState(false);
  const showNotes = can(role, 'internalNotes');
  // Mở từ ô Ghi chú của bảng đơn thì mở sẵn khung ghi chú
  const openNotesOnLoad = readOpenNotes(useLocation().state);

  return (
    <div className={styles.form}>
      <div className={styles.head}>
        <div className={styles.headText}>
          <h1 className={styles.title}>Chi tiết đơn {form.code}</h1>
        </div>
        <div className={styles.headActions}>
          <FormInfoPanelToggle panel={infoPanel} />
          <FormExportButton form={form} />
          {canReceiveForm(role, form.status) && <ReceiveFormButton code={form.code} className={styles.headButton} />}
        </div>
      </div>

      <StatusNotice form={form} />

      <div className={`${styles.grid} ${!infoPanel.isNarrow && infoPanel.isOpen ? styles.withSide : ''}`}>
        {editable ? (
          // Lưu xong hoặc bỏ thay đổi thì vẽ lại từ lá đơn đã lưu (câu trả lời, tệp có id ở máy chủ, bỏ đánh dấu cam đoan)
          <FormEditor key={editorKey} form={form} onReset={() => setEditorKey((count) => count + 1)} />
        ) : (
          <div className={styles.main}>
            <FormSections sections={form.sections} answers={form.answers} readOnly />
            {canDecideOn({ email: user.email, role }, form) && <DecideBar form={form} />}
          </div>
        )}
        <FormInfoPanel panel={infoPanel}>
          <FormInfoSection
            title="Thông tin chung"
            storageKey={INFO_SECTION_STORAGE_KEY.general}
            scrollable
            rows={[
              ['Trạng thái', <StatusPill status={form.status} />],
              ['Loại đơn', form.formTypeName],
              ['Nộp lúc', formatDateTime(form.submittedAt)],
              ['Cập nhật lúc', formatDateTime(form.updatedAt)],
              ...deadlineRows(form.deadline),
            ]}
          />
          <ApplicantInfo form={form} />
          {form.receiver && (
            <FormInfoSection
              title="Người tiếp nhận"
              storageKey={INFO_SECTION_STORAGE_KEY.receiver}
              rows={[
                ['Họ và tên', form.receiver.name],
                ['Tiếp nhận lúc', form.receivedAt ? formatDateTime(form.receivedAt) : EMPTY_TEXT],
              ]}
            />
          )}
          {form.handler && (
            <FormInfoSection
              title="Người xử lí"
              storageKey={INFO_SECTION_STORAGE_KEY.handler}
              action={canTransferForm(role, form) && <button type="button" onClick={() => setTransferOpen(true)}>Chuyển giao</button>}
              rows={[
                ['Họ và tên', form.handler.name],
                ['Phụ trách từ', form.handlerSince ? formatDateTime(form.handlerSince) : EMPTY_TEXT],
              ]}
            />
          )}
          <FormHistory history={form.history} />
        </FormInfoPanel>
      </div>
      <TransferDialog form={form} open={transferOpen} onClose={() => setTransferOpen(false)} />
      {showNotes && <FormNotes code={form.code} initialOpen={openNotesOnLoad} />}
    </div>
  );
}

/**
 * Nội dung đơn sửa được: các phần câu hỏi, và khi đã sửa câu trả lời
 * thì hiện hàng nút có ô cam đoan, "Bỏ thay đổi" và "Lưu thay đổi" (chưa sửa gì thì không hiện, để khỏi nhầm là phải bấm Lưu).
 * Bấm Lưu thay đổi: còn lỗi thì báo như lúc nộp đơn; hợp lệ thì gửi câu trả lời và tệp mới lên máy chủ trong một lần.
 * Lưu xong: đơn Cần bổ sung chuyển sang Đã bổ sung; toast ghi giờ lưu.
 * @param form     lá đơn đang sửa
 * @param onReset  vẽ lại khung sửa từ lá đơn đã lưu (sau khi lưu xong, lá đơn mới đã có trong cache; hoặc khi bỏ thay đổi)
 * @returns        thẻ <form> chiếm cột nội dung đơn
 */
function FormEditor({ form, onReset }: { form: FormDetail; onReset: () => void }) {
  const toast = useToast();
  const saveChanges = useSaveFormChanges(form);
  const { answers, setAnswer, questionErrors, validate } = useFormAnswers(form.sections, form.answers);
  const commitment = useCommitment();
  const changed = answersChanged(form.sections, form.answers, answers);

  /**
   * Bấm Lưu thay đổi (đang lưu thì bỏ qua lần bấm thêm).
   * @param event  sự kiện gửi form (chặn để trang không tải lại)
   */
  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saveChanges.isPending) return;

    // Chưa sửa gì: không gửi
    if (!changed) {
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
          onReset();
        },
        onError: (error) => toast(error.message || SAVE_FAILED_TEXT, 'error'),
      },
    );
  };

  /** Bỏ thay đổi: câu trả lời về như đã lưu (vẽ lại khung sửa), báo bằng toast. */
  const discardChanges = () => {
    onReset();
    toast(FORM_MESSAGES.discarded, 'info');
  };

  return (
    <form className={styles.main} onSubmit={save} noValidate>
      <FormSections sections={form.sections} answers={answers} onAnswerChange={setAnswer} questionErrors={questionErrors} />

      {/* Cam đoan · Bỏ thay đổi · Lưu thay đổi: chỉ hiện khi đã sửa câu trả lời */}
      {changed && (
        <SubmitBar commitment={commitment}>
          <Button variant="ghost" onClick={discardChanges} disabled={saveChanges.isPending}>
            Bỏ thay đổi
          </Button>
          <Button variant="primary" type="submit" disabled={saveChanges.isPending}>
            {saveChanges.isPending ? 'Đang lưu…' : 'Lưu thay đổi'}
          </Button>
        </SubmitBar>
      )}
    </form>
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
 * Có liên kết "Xem hồ sơ ›" (ở trang đó có nút quay lại đơn này): đơn của mình thì sang trang Thông tin cá nhân,
 * đơn người khác thì sang hồ sơ người nộp (chỉ xem), khi có quyền viewApplicant.
 * @param form  lá đơn
 * @returns     khối mục
 */
function ApplicantInfo({ form }: { form: FormDetail }) {
  const { user, role } = useAuth();
  const isMine = form.applicant.id === user.id;
  // Hồ sơ của mình, hoặc hồ sơ người nộp (cán bộ có quyền viewApplicant)
  const profileLink = isMine ? PAGE_PATH.profile : can(role, 'viewApplicant') ? personProfilePath(form.applicant.id) : null;
  return (
    <FormInfoSection
      title="Người nộp đơn"
      storageKey={INFO_SECTION_STORAGE_KEY.applicant}
      action={
        profileLink && (
          <Link to={profileLink} state={{ previousPageLabel: `đơn ${form.code}` } satisfies ReturnState}>
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
