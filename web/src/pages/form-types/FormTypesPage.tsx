/* Trang Quản lí loại đơn (#/quan-li-loai-don), như phần "Danh sách loại đơn" của artifact/js/forms-page.js.
   Bảng mọi loại đơn: tên, mã đơn, trạng thái, lần lưu gần nhất; tìm kiếm / Sắp xếp / Lọc / phân trang dùng chung với các bảng khác.
   Mặc định xếp theo trạng thái (Đang mở → Nháp → Đã đóng) rồi theo tên. Bấm một dòng để mở trình soạn của loại đơn đó;
   "+ Tạo loại đơn" mở trình soạn trống. */
import type { KeyboardEvent } from 'react';
import { useNavigate } from 'react-router';
import { FORM_TYPE_STATUSES, FORM_TYPE_STATUS_LABEL, type FormTypeStatus, type FormTypeSummary } from '@ulaw/shared';
import { useFormTypes } from '../../api/form-types';
import { NEW_FORM_TYPE_ID, PAGE_LABEL, formTypeEditorPath, type ReturnState } from '../../app/paths';
import { Button } from '../../components/Button';
import { LoadError, loadErrorMessage } from '../../components/LoadError';
import { RefreshButton } from '../../components/RefreshButton';
import { FormTypeStatusPill } from '../../components/StatusPill';
import { HeaderCell } from '../../components/table/HeaderCell';
import { Highlight } from '../../components/table/Highlight';
import { Pager } from '../../components/table/Pager';
import { TableToolbar } from '../../components/table/TableToolbar';
import { displayText, type SortRules, type TableField } from '../../components/table/tableTools';
import { useTableTools } from '../../components/table/useTableTools';
import { EMPTY_TEXT } from '../../lib/format';
import tableStyles from '../../components/table/table.module.css';
import profileStyles from '../profile/ProfilePage.module.css';
import styles from './FormTypesPage.module.css';

/** Thứ tự trạng thái khi sắp xếp tăng dần, như FM_ORDER của bản mẫu: Đang mở → Nháp → Đã đóng. */
const STATUS_ORDER: Record<FormTypeStatus, number> = { open: 0, draft: 1, closed: 2 };

/** Các cột, như FM_FIELDS của bản mẫu. */
const FORM_TYPE_FIELDS: TableField<FormTypeSummary>[] = [
  { key: 'name', label: 'Tên loại đơn', type: 'text', getValue: (formType) => formType.name },
  { key: 'prefix', label: 'Mã đơn', type: 'text', getValue: (formType) => formType.prefix },
  {
    key: 'status',
    label: 'Trạng thái',
    type: 'select',
    getValue: (formType) => formType.status,
    getLabel: (formType) => FORM_TYPE_STATUS_LABEL[formType.status],
    options: FORM_TYPE_STATUSES.map((status) => ({ value: status, label: FORM_TYPE_STATUS_LABEL[status] })),
    getOrder: (formType) => STATUS_ORDER[formType.status],
  },
  { key: 'updatedAt', label: 'Cập nhật lúc', type: 'datetime', getValue: (formType) => formType.updatedAt },
  { key: 'updatedBy', label: 'Người cập nhật', type: 'text', getValue: (formType) => formType.updatedBy.name },
];

/** Thứ tự khi chưa chọn sắp xếp: theo trạng thái, rồi theo tên. */
const DEFAULT_SORTING: SortRules = [
  { id: 'status', desc: false },
  { id: 'name', desc: false },
];

/** Số loại đơn mỗi trang. */
const PAGE_SIZE = 10;

/** Mảng rỗng dùng chung khi chưa tải xong, để bảng không bị tính lại mỗi lần vẽ. */
const NO_FORM_TYPES: FormTypeSummary[] = [];

/** Số cột của bảng: các cột dữ liệu và cột "Soạn ›". */
const COLUMN_COUNT = FORM_TYPE_FIELDS.length + 1;

/**
 * Trang Quản lí loại đơn.
 * @returns  thẻ bảng loại đơn: tiêu đề, nút ↻ và "+ Tạo loại đơn" ở đầu thẻ (cùng kiểu trang Quản lí đơn)
 */
export function FormTypesPage() {
  const navigate = useNavigate();
  const formTypesQuery = useFormTypes();
  const { table, query, setQuery, sorting, setSorting, filterRules, setFilterRules, matchedCount, hasCriteria } =
    useTableTools({
      tableId: 'formTypes.all',
      rows: formTypesQuery.data ?? NO_FORM_TYPES,
      fields: FORM_TYPE_FIELDS,
      defaultSorting: DEFAULT_SORTING,
      pageSize: PAGE_SIZE,
      getRowId: (formType) => formType.id,
    });
  const pageRows = table.getRowModel().rows;
  const errorMessage = loadErrorMessage(formTypesQuery);

  // Mở trình soạn (trang soạn có nút "‹ Quay lại Quản lí loại đơn"); Enter trên dòng đang chọn cũng mở
  const openEditor = (formTypeId: string) =>
    navigate(formTypeEditorPath(formTypeId), { state: { previousPageLabel: PAGE_LABEL.formTypes } satisfies ReturnState });
  const openOnEnter = (event: KeyboardEvent<HTMLTableRowElement>, formTypeId: string) => {
    if (event.target !== event.currentTarget || event.key !== 'Enter') return;
    event.preventDefault();
    openEditor(formTypeId);
  };

  return (
    <div className={profileStyles.page}>
      <section className={`${profileStyles.card} ${profileStyles.tableCard}`} aria-labelledby="form-types-title">
        <div className={profileStyles.sectionHead}>
          <div className={profileStyles.titleGroup}>
            <h1 id="form-types-title" className={styles.title}>
              Quản lí loại đơn
            </h1>
            <RefreshButton query={formTypesQuery} label="Quản lí loại đơn" size="small" />
          </div>
          <Button variant="primary" onClick={() => openEditor(NEW_FORM_TYPE_ID)}>
            + Tạo loại đơn
          </Button>
        </div>

        <TableToolbar
          fields={FORM_TYPE_FIELDS}
          rows={formTypesQuery.data ?? NO_FORM_TYPES}
          query={query}
          onQueryChange={setQuery}
          searchPlaceholder="Tìm theo tên loại đơn, mã đơn, người cập nhật"
          searchLabel="Tìm loại đơn"
          sorting={sorting}
          onSortingChange={setSorting}
          defaultSortNote="Bảng đang xếp theo trạng thái (Đang mở → Nháp → Đã đóng), rồi theo tên loại đơn."
          filterRules={filterRules}
          onFilterRulesChange={setFilterRules}
          defaultFilterKey="status"
        />

        <div className={tableStyles.tableWrap}>
          <table className={tableStyles.table}>
            <thead>
              <tr>
                {FORM_TYPE_FIELDS.map((field) => (
                  <HeaderCell key={field.key} field={field} sorting={sorting} filterRules={filterRules} />
                ))}
                <th>
                  <span className="sr-only">Soạn loại đơn</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {formTypesQuery.isPending ? (
                <MessageRow text="Đang tải danh sách loại đơn…" />
              ) : errorMessage ? (
                <tr>
                  <td colSpan={COLUMN_COUNT} className={tableStyles.messageCell}>
                    <LoadError message={errorMessage} />
                  </td>
                </tr>
              ) : pageRows.length === 0 ? (
                <MessageRow
                  text={
                    hasCriteria
                      ? 'Không có loại đơn nào khớp điều kiện tìm kiếm và bộ lọc.'
                      : 'Chưa có loại đơn nào. Bấm “+ Tạo loại đơn” để bắt đầu.'
                  }
                />
              ) : (
                pageRows.map(({ original: formType }) => (
                  <tr
                    key={formType.id}
                    className={tableStyles.rowLink}
                    tabIndex={0}
                    onClick={() => openEditor(formType.id)}
                    onKeyDown={(event) => openOnEnter(event, formType.id)}
                  >
                    {FORM_TYPE_FIELDS.map((field) => (
                      <FormTypeCell key={field.key} field={field} formType={formType} query={query} />
                    ))}
                    <td className={tableStyles.goCell}>
                      <span className={tableStyles.goLabel}>Soạn ›</span>
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
          unit="loại đơn"
          onPageChange={table.setPageIndex}
        />
      </section>
    </div>
  );
}

/**
 * Một ô của bảng loại đơn: tên in đậm, mã đơn kiểu mã, trạng thái là nhãn màu, còn lại là chữ; ô trống ghi "—".
 * @param field     cột
 * @param formType  loại đơn của dòng
 * @param query     chữ đang tìm, để tô sáng
 * @returns         thẻ <td>
 */
function FormTypeCell({ field, formType, query }: { field: TableField<FormTypeSummary>; formType: FormTypeSummary; query: string }) {
  if (field.key === 'status') {
    return (
      <td>
        <FormTypeStatusPill status={formType.status} query={query} />
      </td>
    );
  }
  const text = displayText(field, formType);
  const cellClass = field.key === 'name' ? tableStyles.nameCell : field.key === 'prefix' ? tableStyles.codeCell : '';
  return (
    <td className={cellClass}>
      {text ? <Highlight text={text} query={query} /> : <span className={tableStyles.dash}>{EMPTY_TEXT}</span>}
    </td>
  );
}

/**
 * Một dòng chữ chiếm cả bề ngang bảng: đang tải, hoặc không có loại đơn.
 * @param text  câu cần hiện
 * @returns     thẻ <tr>
 */
function MessageRow({ text }: { text: string }) {
  return (
    <tr>
      <td colSpan={COLUMN_COUNT} className={tableStyles.messageCell}>
        {text}
      </td>
    </tr>
  );
}
