/* Trang Quản lí đơn: bảng mọi đơn của mọi người nộp, gộp thông tin đơn
   và thông tin người nộp (cột theo MANAGED_FORM_LIST_FIELDS, Họ và tên mở đầu nhóm bên phải);
   tìm kiếm / Sắp xếp / Lọc / phân trang ở máy chủ, dùng chung với các bảng đơn khác.
   Cột "Thời gian tiếp nhận" có nút Tiếp nhận cho đơn đang chờ; nút Hiện CCCD (thanh công cụ, sau nút Lọc) bỏ che số CCCD
   của những người đang có trên trang bảng. */
import { useMemo, useState, type ReactElement } from 'react';
import { MANAGED_FORM_LIST_FIELDS, canReceiveForm, type ManagedFormSummary } from '@ulaw/shared';
import { ALL_FORMS_SOURCE, useApplicantCccds, useFormStats } from '../../api/forms';
import { RefreshButton } from '../../components/RefreshButton';
import { useCccdToggle } from '../../components/table/CccdToggleButton';
import { Highlight } from '../../components/table/Highlight';
import { readTableState } from '../../components/table/tableStateStore';
import { equalsFilterValue, toggleEqualsFilter, type FilterRule, type TableField } from '../../components/table/tableTools';
import { useServerTable } from '../../components/table/useServerTable';
import { useAuth } from '../../features/auth/useAuth';
import { ReceiveFormButton } from '../../features/receive/ReceiveFormButton';
import { EMPTY_TEXT, formatDateTime, formatPhone } from '../../lib/format';
import tableStyles from '../../components/table/table.module.css';
import profileStyles from '../profile/ProfilePage.module.css';
import { FORM_PAGE_SIZE, FormTable } from '../profile/FormTable';
import { FormStatsPanel } from './FormStatsPanel';
import styles from './FormsPage.module.css';

/** Tên bảng, để nhớ cách xem khi đi qua trang khác. */
const TABLE_ID = 'forms.all';

/**
 * Trang Quản lí đơn.
 * @returns  tiêu đề và bảng mọi đơn (nút Hiện CCCD trên thanh công cụ, sau nút Lọc)
 */
export function FormsPage() {
  const { role } = useAuth();
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
  const pageForms = formsTable.rows;
  const { revealedCccds: revealed, toggleButton: cccdToggleButton } = useCccdToggle(
    useApplicantCccds,
    pageForms.map((form) => form.applicant.id),
  );

  // Đang hiện CCCD thì thay số che bằng số đầy đủ (người chưa có CCCD giữ nguyên null)
  const rows = useMemo(() => {
    if (!revealed) return pageForms;
    return pageForms.map((form) => ({
      ...form,
      applicant: { ...form.applicant, maskedCccd: revealed[form.applicant.id] ?? form.applicant.maskedCccd },
    }));
  }, [pageForms, revealed]);

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
            <ReceiveFormButton code={form.code} className={styles.receiveButton} inRow />
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
          extraButtons={cccdToggleButton}
        />
      </section>
    </div>
  );
}
