/* Trang Quản lí đơn (như applications-page.js của bản mẫu): bảng mọi đơn của mọi người nộp, gộp thông tin đơn
   và thông tin người nộp; tìm kiếm / Sắp xếp / Lọc / phân trang dùng chung với các bảng đơn khác.
   Cột "Thời gian tiếp nhận" có nút Tiếp nhận cho đơn đang chờ; nút Hiện CCCD bỏ che số CCCD. */
import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { FORM_MESSAGES, canReceiveForm, type ManagedFormSummary } from '@ulaw/shared';
import { useReceiveForm } from '../../api/form';
import { useAllForms, useApplicantCccds } from '../../api/forms';
import { Button } from '../../components/Button';
import { loadErrorMessage } from '../../components/LoadError';
import { RefreshButton } from '../../components/RefreshButton';
import { Highlight } from '../../components/table/Highlight';
import type { TableField } from '../../components/table/tableTools';
import { useToast } from '../../components/Toast';
import { useAuth } from '../../features/auth/useAuth';
import { EMPTY_TEXT, formatDateTime, formatPhone } from '../../lib/format';
import tableStyles from '../../components/table/table.module.css';
import profileStyles from '../profile/ProfilePage.module.css';
import { BASE_FORM_FIELDS, FormTable } from '../profile/FormTable';
import styles from './FormsPage.module.css';

/** Các cột: thông tin đơn, lúc tiếp nhận, rồi thông tin người nộp (Họ và tên mở đầu nhóm bên phải). */
const MANAGED_FORM_FIELDS: TableField<ManagedFormSummary>[] = [
  ...BASE_FORM_FIELDS,
  { key: 'receivedAt', label: 'Thời gian tiếp nhận', type: 'datetime', getValue: (form) => form.receivedAt },
  { key: 'name', label: 'Họ và tên', type: 'text', getValue: (form) => form.applicant.name },
  { key: 'cccd', label: 'Số CCCD', type: 'text', getValue: (form) => form.applicant.maskedCccd },
  { key: 'phone', label: 'Số điện thoại', type: 'text', getValue: (form) => form.applicant.phone },
  { key: 'email', label: 'Email', type: 'text', getValue: (form) => form.applicant.email },
];

/** Mảng rỗng dùng chung khi chưa tải xong, để bảng không bị tính lại mỗi lần vẽ. */
const NO_FORMS: ManagedFormSummary[] = [];

const RECEIVE_FAILED_TEXT = 'Chưa tiếp nhận được đơn. Kiểm tra kết nối mạng rồi bấm Tiếp nhận lại.';
const CCCD_FAILED_TEXT = 'Chưa tải được số CCCD. Kiểm tra kết nối mạng rồi bấm Hiện CCCD lại.';

/**
 * Trang Quản lí đơn.
 * @returns  tiêu đề, nút Hiện CCCD và bảng mọi đơn
 */
export function FormsPage() {
  const { role } = useAuth();
  const toast = useToast();
  const formsQuery = useAllForms();
  const [showCccd, setShowCccd] = useState(false);
  const cccdsQuery = useApplicantCccds(showCccd);

  // Đang hiện CCCD thì thay số che bằng số đầy đủ (người chưa có CCCD giữ nguyên null)
  const revealed = showCccd && cccdsQuery.data ? cccdsQuery.data : null;
  const rows = useMemo(() => {
    const forms = formsQuery.data ?? NO_FORMS;
    if (!revealed) return forms;
    return forms.map((form) => ({
      ...form,
      applicant: { ...form.applicant, maskedCccd: revealed[form.applicant.id] ?? form.applicant.maskedCccd },
    }));
  }, [formsQuery.data, revealed]);

  // Tải CCCD lỗi thì báo và tự ẩn lại (bấm Hiện CCCD để thử lần nữa)
  const cccdsError = cccdsQuery.isError ? cccdsQuery.error : null;
  useEffect(() => {
    if (!cccdsError) return;
    toast(cccdsError.message || CCCD_FAILED_TEXT, 'error');
    setShowCccd(false);
  }, [cccdsError, toast]);

  /**
   * Tự vẽ ô "Thời gian tiếp nhận" (nút Tiếp nhận cho đơn đang chờ), "Số CCCD" và "Số điện thoại".
   * @param field  cột
   * @param form   đơn của dòng
   * @param query  chữ đang tìm, để tô sáng
   * @returns      thẻ <td>; cột khác thì undefined (dùng cách vẽ mặc định)
   */
  const renderCell = (field: TableField<ManagedFormSummary>, form: ManagedFormSummary, query: string): ReactElement | undefined => {
    if (field.key === 'receivedAt') {
      return (
        <td key={field.key} className={tableStyles.numberCell}>
          {canReceiveForm(role, form.status) ? (
            <ReceiveButton code={form.code} />
          ) : form.receivedAt ? (
            <Highlight text={formatDateTime(form.receivedAt)} query={query} />
          ) : (
            <span className={tableStyles.dash}>{EMPTY_TEXT}</span>
          )}
        </td>
      );
    }
    if (field.key === 'cccd' || field.key === 'phone') {
      const text = field.key === 'cccd' ? form.applicant.maskedCccd : form.applicant.phone ? formatPhone(form.applicant.phone) : null;
      return (
        <td key={field.key} className={styles.cccdCell}>
          {text ? <Highlight text={text} query={query} /> : <span className={tableStyles.dash}>{EMPTY_TEXT}</span>}
        </td>
      );
    }
    return undefined;
  };

  return (
    <div className={profileStyles.page}>
      <section className={`${profileStyles.card} ${profileStyles.tableCard}`} aria-labelledby="all-forms-title">
        <div className={profileStyles.sectionHead}>
          <div className={profileStyles.titleGroup}>
            <h1 id="all-forms-title" className={styles.title}>
              Quản lí đơn
            </h1>
            <RefreshButton query={formsQuery} label="Quản lí đơn" size="small" />
          </div>
          <Button aria-pressed={showCccd} onClick={() => setShowCccd((isShown) => !isShown)} disabled={showCccd && cccdsQuery.isPending}>
            {showCccd ? (cccdsQuery.isPending ? 'Đang tải…' : 'Ẩn CCCD') : 'Hiện CCCD'}
          </Button>
        </div>

        <FormTable
          tableId="forms.all"
          fields={MANAGED_FORM_FIELDS}
          rows={rows}
          isPending={formsQuery.isPending}
          errorMessage={loadErrorMessage(formsQuery)}
          searchPlaceholder="Tìm theo mã đơn, loại đơn, họ tên, CCCD, số điện thoại, email"
          searchLabel="Tìm đơn"
          emptyText="Chưa có đơn nào."
          groupStartKey="name"
          pageLabel="Quản lí đơn"
          renderCell={renderCell}
        />
      </section>
    </div>
  );
}

/**
 * Nút "Tiếp nhận" nhỏ trong bảng. Bấm thì đơn chuyển sang Đang xét; bảng tự cập nhật, toast ghi giờ tiếp nhận.
 * @param code  mã đơn đang chờ tiếp nhận
 * @returns     nút bấm; đang gửi thì khóa nút. Bấm nút không mở trang chi tiết của dòng
 */
function ReceiveButton({ code }: { code: string }) {
  const toast = useToast();
  const receive = useReceiveForm(code);

  /** Gửi lên máy chủ; xong thì báo giờ tiếp nhận, lỗi thì báo câu máy chủ gửi. */
  const receiveForm = () =>
    receive.mutate(undefined, {
      onSuccess: (receivedForm) =>
        toast(FORM_MESSAGES.received(receivedForm.code, formatDateTime(receivedForm.receivedAt ?? receivedForm.updatedAt)), 'success'),
      onError: (error) => toast(error.message || RECEIVE_FAILED_TEXT, 'error'),
    });

  return (
    <Button
      variant="primary"
      className={styles.receiveButton}
      disabled={receive.isPending}
      onClick={(event) => {
        event.stopPropagation();
        receiveForm();
      }}
      onKeyDown={(event) => event.stopPropagation()}
    >
      {receive.isPending ? 'Đang tiếp nhận…' : 'Tiếp nhận'}
    </Button>
  );
}
