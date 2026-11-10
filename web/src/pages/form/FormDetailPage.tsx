/* Trang chi tiết một lá đơn (#/don/<mã đơn>), như openDetail() trong artifact/js/application-form.js.
   Gồm: tiêu đề, khung thông báo theo trạng thái, nội dung đơn (dạng chỉ xem), khung "Thông tin đơn" bên phải
   (trạng thái, ngày nộp, người nộp đơn, người tiếp nhận, người xử lí).
   Sửa đơn, Tiếp nhận, Yêu cầu bổ sung / Duyệt / Từ chối, Chuyển giao: thêm ở các phần sau của bước 5. */
import { Link, useParams } from 'react-router';
import type { FormDetail, FormStatus } from '@ulaw/shared';
import { useFormDetail } from '../../api/forms';
import { PAGE_PATH, type ReturnState } from '../../app/paths';
import { LoadError, loadErrorMessage } from '../../components/LoadError';
import { RefreshButton } from '../../components/RefreshButton';
import { StatusPill } from '../../components/StatusPill';
import { useAuth } from '../../features/auth/useAuth';
import { FormSections } from '../../features/form-renderer/FormSections';
import { EMPTY_TEXT, formatDateTime } from '../../lib/format';
import { FormInfoPanel, FormInfoPanelToggle, FormInfoSection, useFormInfoPanel } from './FormInfoPanel';
import styles from './FormPage.module.css';
import { useLeavePage } from './useLeavePage';

/** Câu báo khi không tải được đơn mà máy chủ không gửi kèm câu báo lỗi (vd mất mạng). */
const LOAD_FAILED_TEXT = 'Không tải được đơn.';

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
 * @returns     tiêu đề, khung thông báo, nội dung đơn và khung Thông tin đơn
 */
function FormDetailView({ form }: { form: FormDetail }) {
  const infoPanel = useFormInfoPanel();

  return (
    <div className={styles.form}>
      <div className={styles.head}>
        <div className={styles.headText}>
          <h1 className={styles.title}>Chi tiết đơn {form.code}</h1>
        </div>
        <FormInfoPanelToggle panel={infoPanel} />
      </div>

      <StatusNotice form={form} />

      <div className={`${styles.grid} ${!infoPanel.isNarrow && infoPanel.isOpen ? styles.withSide : ''}`}>
        <div className={styles.main}>
          <FormSections sections={form.sections} answers={form.answers} readOnly />
        </div>
        <FormInfoPanel panel={infoPanel}>
          <FormInfoSection
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
              rows={[
                ['Họ và tên', form.handler.name],
                ['Phụ trách từ', form.handlerSince ? formatDateTime(form.handlerSince) : EMPTY_TEXT],
              ]}
            />
          )}
        </FormInfoPanel>
      </div>
    </div>
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
