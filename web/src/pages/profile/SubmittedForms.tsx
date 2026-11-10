/* Mục "Đơn đã nộp" trên trang Thông tin cá nhân (như submittedTable trong artifact/js/profile.js):
   bảng các đơn của mình, có tìm kiếm, Sắp xếp, Lọc, phân trang; bấm một dòng để mở trang chi tiết đơn.
   Chưa có phần xem nhanh (nút › đầu dòng): cần khung nội dung đơn, làm ở bước Nộp đơn. */
import type { KeyboardEvent } from 'react';
import { useNavigate } from 'react-router';
import { FORM_STATUSES, FORM_STATUS_LABEL, type FormSummary } from '@ulaw/shared';
import { useMyForms } from '../../api/forms';
import { NEW_FORM_PATH, formPath } from '../../app/paths';
import { Button } from '../../components/Button';
import { StatusPill } from '../../components/StatusPill';
import { HeaderCell } from '../../components/table/HeaderCell';
import { Highlight } from '../../components/table/Highlight';
import { Pager } from '../../components/table/Pager';
import { TableToolbar } from '../../components/table/TableToolbar';
import { type SortRules, type TableField } from '../../components/table/tableTools';
import { useTableTools } from '../../components/table/useTableTools';
import { useCan } from '../../features/auth/useAuth';
import { formatDate } from '../../lib/format';
import tableStyles from '../../components/table/table.module.css';
import styles from './ProfilePage.module.css';

/** Các cột của bảng (như P_FIELDS của bản mẫu). Tìm kiếm, Sắp xếp, Lọc đều theo các cột này. */
const SUBMITTED_FORM_FIELDS: TableField<FormSummary>[] = [
  { key: 'code', label: 'Mã đơn', type: 'text', getValue: (form) => form.code },
  {
    key: 'formType',
    label: 'Loại đơn',
    type: 'select',
    getValue: (form) => form.formTypeId,
    getLabel: (form) => form.formTypeName,
  },
  { key: 'submittedAt', label: 'Ngày nộp', type: 'date', getValue: (form) => form.submittedAt },
  {
    key: 'status',
    label: 'Trạng thái',
    type: 'select',
    getValue: (form) => form.status,
    getLabel: (form) => FORM_STATUS_LABEL[form.status],
    options: FORM_STATUSES.map((status) => ({ value: status, label: FORM_STATUS_LABEL[status] })),
  },
];

/** Thứ tự khi chưa chọn sắp xếp: đơn mới nộp lên trên, cùng lúc thì mã đơn lớn lên trên. */
const DEFAULT_SORTING: SortRules = [
  { id: 'submittedAt', desc: true },
  { id: 'code', desc: true },
];

/** Số đơn mỗi trang, như PER của bản mẫu. */
const PAGE_SIZE = 8;

/** Mảng rỗng dùng chung khi chưa tải xong, để bảng không bị tính lại mỗi lần vẽ. */
const NO_FORMS: FormSummary[] = [];

/**
 * Mục "Đơn đã nộp".
 * @returns  khung có tiêu đề, nút Nộp đơn mới (nếu có quyền nộp đơn), thanh công cụ, bảng và phân trang
 */
export function SubmittedForms() {
  const navigate = useNavigate();
  const canSubmit = useCan('submit');
  const formsQuery = useMyForms();
  const forms = formsQuery.data ?? NO_FORMS;
  const { table, query, setQuery, sorting, setSorting, filterRules, setFilterRules, matchedCount, hasCriteria } =
    useTableTools({
      tableId: 'profile.submittedForms',
      rows: forms,
      fields: SUBMITTED_FORM_FIELDS,
      defaultSorting: DEFAULT_SORTING,
      pageSize: PAGE_SIZE,
      getRowId: (form) => form.code,
    });
  const pageRows = table.getRowModel().rows;
  const columnCount = SUBMITTED_FORM_FIELDS.length + 1;

  // Bấm dòng hoặc nhấn Enter khi dòng đang được chọn: mở trang chi tiết đơn
  const openForm = (code: string) => navigate(formPath(code));
  const openOnEnter = (event: KeyboardEvent<HTMLTableRowElement>, code: string) => {
    if (event.target !== event.currentTarget || event.key !== 'Enter') return;
    event.preventDefault();
    openForm(code);
  };

  // Câu hiện thay cho bảng khi chưa có dòng nào để hiện
  const emptyText = hasCriteria
    ? 'Không có đơn nào khớp điều kiện tìm kiếm và bộ lọc.'
    : canSubmit
      ? 'Chưa có đơn nào. Bấm “Nộp đơn mới” để tạo đơn.'
      : 'Chưa có đơn nào.';

  return (
    <section className={`${styles.card} ${styles.tableCard}`} aria-labelledby="submitted-forms-title">
      <div className={styles.sectionHead}>
        <h2 id="submitted-forms-title">Đơn đã nộp</h2>
        {canSubmit && (
          <Button variant="primary" onClick={() => navigate(NEW_FORM_PATH)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Nộp đơn mới
          </Button>
        )}
      </div>

      <TableToolbar
        fields={SUBMITTED_FORM_FIELDS}
        rows={forms}
        query={query}
        onQueryChange={setQuery}
        searchPlaceholder="Tìm theo mã đơn, loại đơn, ngày nộp, trạng thái"
        searchLabel="Tìm đơn đã nộp"
        sorting={sorting}
        onSortingChange={setSorting}
        defaultSortNote="Bảng đang xếp đơn mới nộp lên trên."
        filterRules={filterRules}
        onFilterRulesChange={setFilterRules}
        defaultFilterKey="status"
      />

      <div className={tableStyles.tableWrap}>
        <table className={tableStyles.table}>
          <thead>
            <tr>
              {SUBMITTED_FORM_FIELDS.map((field) => (
                <HeaderCell key={field.key} field={field} sorting={sorting} filterRules={filterRules} />
              ))}
              <th>
                <span className="sr-only">Mở đơn</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {formsQuery.isPending ? (
              <MessageRow columnCount={columnCount} text="Đang tải danh sách đơn…" />
            ) : formsQuery.isError ? (
              <MessageRow
                columnCount={columnCount}
                text={formsQuery.error.message || 'Không tải được danh sách đơn. Hãy thử tải lại trang.'}
                isError
              />
            ) : pageRows.length === 0 ? (
              <MessageRow columnCount={columnCount} text={emptyText} />
            ) : (
              pageRows.map(({ original: form }) => (
                <tr
                  key={form.code}
                  className={tableStyles.rowLink}
                  tabIndex={0}
                  onClick={() => openForm(form.code)}
                  onKeyDown={(event) => openOnEnter(event, form.code)}
                >
                  <td className={tableStyles.codeCell}>
                    <Highlight text={form.code} query={query} />
                  </td>
                  <td>
                    <Highlight text={form.formTypeName} query={query} />
                  </td>
                  <td className={tableStyles.numberCell}>
                    <Highlight text={formatDate(form.submittedAt)} query={query} />
                  </td>
                  <td>
                    <StatusPill status={form.status} query={query} />
                  </td>
                  <td className={tableStyles.goCell}>
                    <span className={tableStyles.goLabel}>Chi tiết ›</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Pager
        pageIndex={table.getState().pagination.pageIndex}
        pageCount={table.getPageCount()}
        pageSize={PAGE_SIZE}
        total={matchedCount}
        unit="đơn"
        onPageChange={table.setPageIndex}
      />
    </section>
  );
}

/**
 * Một dòng chữ chiếm cả bề ngang bảng: đang tải, lỗi, hoặc không có đơn.
 * @param columnCount  số cột của bảng
 * @param text         câu cần hiện
 * @param isError      true thì chữ màu lỗi và được đọc ngay cho trình đọc màn hình
 * @returns            thẻ <tr>
 */
function MessageRow({ columnCount, text, isError = false }: { columnCount: number; text: string; isError?: boolean }) {
  return (
    <tr>
      <td
        colSpan={columnCount}
        className={`${tableStyles.messageCell} ${isError ? tableStyles.errorCell : ''}`}
        role={isError ? 'alert' : undefined}
      >
        {text}
      </td>
    </tr>
  );
}
