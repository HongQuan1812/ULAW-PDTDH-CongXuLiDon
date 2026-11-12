/* Trang Quản lí đơn (như applications-page.js của bản mẫu): bảng mọi đơn của mọi người nộp, gộp thông tin đơn
   và thông tin người nộp (cột theo MANAGED_FORM_LIST_FIELDS, Họ và tên mở đầu nhóm bên phải);
   tìm kiếm / Sắp xếp / Lọc / phân trang ở máy chủ, dùng chung với các bảng đơn khác.
   Cột "Thời gian tiếp nhận" có nút Tiếp nhận cho đơn đang chờ; nút Hiện CCCD (thanh công cụ, sau nút Lọc) bỏ che số CCCD
   của những người đang có trên trang bảng. */
import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { FORM_MESSAGES, MANAGED_FORM_LIST_FIELDS, canReceiveForm, type ManagedFormSummary } from '@ulaw/shared';
import { useReceiveForm } from '../../api/form';
import { ALL_FORMS_SOURCE, useApplicantCccds, useFormStats } from '../../api/forms';
import { Button } from '../../components/Button';
import { RefreshButton } from '../../components/RefreshButton';
import { CccdToggleButton } from '../../components/table/CccdToggleButton';
import { Highlight } from '../../components/table/Highlight';
import { readTableState } from '../../components/table/tableStateStore';
import { equalsFilterValue, toggleEqualsFilter, type FilterRule, type TableField } from '../../components/table/tableTools';
import { useServerTable } from '../../components/table/useServerTable';
import { useToast } from '../../components/Toast';
import { useAuth } from '../../features/auth/useAuth';
import { EMPTY_TEXT, formatDateTime, formatPhone } from '../../lib/format';
import tableStyles from '../../components/table/table.module.css';
import profileStyles from '../profile/ProfilePage.module.css';
import { FORM_PAGE_SIZE, FormTable } from '../profile/FormTable';
import { FormStatsPanel } from './FormStatsPanel';
import styles from './FormsPage.module.css';

/** Tên bảng, để nhớ cách xem khi đi qua trang khác. */
const TABLE_ID = 'forms.all';

const RECEIVE_FAILED_TEXT = 'Chưa tiếp nhận được đơn. Kiểm tra kết nối mạng rồi bấm Tiếp nhận lại.';
const CCCD_FAILED_TEXT = 'Chưa tải được số CCCD. Kiểm tra kết nối mạng rồi bấm Hiện CCCD lại.';

/**
 * Trang Quản lí đơn.
 * @returns  tiêu đề và bảng mọi đơn (nút Hiện CCCD trên thanh công cụ, sau nút Lọc)
 */
export function FormsPage() {
  const { role } = useAuth();
  const toast = useToast();
  const statsQuery = useFormStats();

  // Điều kiện lọc của bảng do trang giữ, để ô thống kê bấm được là lọc bảng (bắt đầu từ cách xem đã nhớ)
  const [filterRules, setFilterRules] = useState<FilterRule[]>(() => readTableState(TABLE_ID)?.filterRules ?? []);
  const formsTable = useServerTable({
    tableId: TABLE_ID,
    source: ALL_FORMS_SOURCE,
    pageSize: FORM_PAGE_SIZE,
    filterRules,
    onFilterRulesChange: setFilterRules,
  });

  // Hiện CCCD: chỉ tải CCCD của những người nộp đang có trên trang bảng
  const [showCccd, setShowCccd] = useState(false);
  const pageForms = formsTable.rows;
  const cccdsQuery = useApplicantCccds(showCccd, pageForms.map((form) => form.applicant.id));

  // Đang hiện CCCD thì thay số che bằng số đầy đủ (người chưa có CCCD giữ nguyên null)
  const revealed = showCccd && cccdsQuery.data ? cccdsQuery.data : null;
  const rows = useMemo(() => {
    if (!revealed) return pageForms;
    return pageForms.map((form) => ({
      ...form,
      applicant: { ...form.applicant, maskedCccd: revealed[form.applicant.id] ?? form.applicant.maskedCccd },
    }));
  }, [pageForms, revealed]);

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
      <FormStatsPanel
        statsQuery={statsQuery}
        activeStatus={equalsFilterValue(filterRules, 'status')}
        activeFormTypeId={equalsFilterValue(filterRules, 'formType')}
        onToggleStatus={(status) => setFilterRules((rules) => toggleEqualsFilter(rules, 'status', status))}
        onToggleFormType={(formTypeId) => setFilterRules((rules) => toggleEqualsFilter(rules, 'formType', formTypeId))}
      />
      <section className={`${profileStyles.card} ${profileStyles.tableCard}`} aria-labelledby="all-forms-title">
        <div className={profileStyles.sectionHead}>
          <div className={profileStyles.titleGroup}>
            <h1 id="all-forms-title" className={styles.title}>
              Quản lí đơn
            </h1>
            <RefreshButton query={formsTable.pageQuery} label="Quản lí đơn" size="small" />
          </div>
        </div>

        <FormTable
          table={formsTable}
          fields={MANAGED_FORM_LIST_FIELDS}
          rows={rows}
          searchPlaceholder="Tìm theo mã đơn, loại đơn, họ tên, CCCD, số điện thoại, email"
          searchLabel="Tìm đơn"
          emptyText="Chưa có đơn nào."
          groupStartKey="name"
          pageLabel="Quản lí đơn"
          renderCell={renderCell}
          extraButtons={
            <CccdToggleButton
              shown={showCccd}
              loading={showCccd && cccdsQuery.isFetching}
              onToggle={() => setShowCccd((isShown) => !isShown)}
            />
          }
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
