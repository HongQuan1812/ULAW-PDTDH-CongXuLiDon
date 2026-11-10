/* Bảng đơn trên trang Thông tin cá nhân, dùng chung cho mục "Đơn đã nộp" và "Đơn phụ trách"
   (như createAppTable() trong artifact/js/profile.js): cùng các cột thông tin đơn, tìm kiếm / Sắp xếp / Lọc,
   phân trang; bấm một dòng để mở trang chi tiết đơn.
   Nút › đầu dòng (và nút mở / đóng tất cả ở tiêu đề) sổ xuống phần xem nhanh ngay trong bảng (QuickView). */
import { Fragment, useState, type KeyboardEvent, type ReactElement } from 'react';
import { useNavigate } from 'react-router';
import { FORM_STATUSES, FORM_STATUS_LABEL, type FormSummary } from '@ulaw/shared';
import { formPath, PAGE_LABEL, type ReturnState } from '../../app/paths';
import { StatusPill } from '../../components/StatusPill';
import { LoadError } from '../../components/LoadError';
import { HeaderCell } from '../../components/table/HeaderCell';
import { Highlight } from '../../components/table/Highlight';
import { Pager } from '../../components/table/Pager';
import { TableToolbar } from '../../components/table/TableToolbar';
import { displayText, type SortRules, type TableField } from '../../components/table/tableTools';
import { useTableTools } from '../../components/table/useTableTools';
import { EMPTY_TEXT, formatDate } from '../../lib/format';
import tableStyles from '../../components/table/table.module.css';
import { QuickView } from './QuickView';
import quickStyles from './QuickView.module.css';

/** Các cột thông tin đơn của mọi bảng đơn (như P_FIELDS của bản mẫu): Mã đơn, Loại đơn, Ngày nộp, Trạng thái. */
export const BASE_FORM_FIELDS: TableField<FormSummary>[] = [
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

interface FormTableProps<Row extends FormSummary> {
  /** Tên riêng của bảng, để nhớ cách xem khi đi qua trang khác, vd 'profile.submittedForms' */
  tableId: string;
  /** Các cột: BASE_FORM_FIELDS, có thể thêm cột phía sau (vd Người tiếp nhận). Khai báo ngoài component */
  fields: readonly TableField<Row>[];
  /** Các đơn; phải giữ nguyên tham chiếu giữa các lần vẽ (lấy thẳng từ useQuery) */
  rows: readonly Row[];
  /** Đang tải lần đầu */
  isPending: boolean;
  /** Câu báo khi chưa tải được đơn nào (lấy bằng loadErrorMessage()); null = không lỗi */
  errorMessage: string | null;
  /** Gợi ý trong ô tìm kiếm */
  searchPlaceholder: string;
  /** Tên ô tìm kiếm cho trình đọc màn hình */
  searchLabel: string;
  /** Câu hiện khi chưa có đơn nào (không tính lúc đang tìm, lọc) */
  emptyText: string;
  /** Cột mở đầu nhóm cột bên phải, có đường kẻ dọc ngăn cách (như trang Quản lí đơn), vd 'receiver' */
  groupStartKey?: string;
  /** Tên trang này trong nút quay lại của trang đơn ("‹ Quay lại …"); bỏ trống = Thông tin cá nhân */
  pageLabel?: string;
  /** Tự vẽ ô của một số cột (vd nút Tiếp nhận); trả về thẻ <td> có key, hoặc undefined để dùng cách vẽ mặc định */
  renderCell?: (field: TableField<Row>, form: Row, query: string) => ReactElement | undefined;
}

/**
 * Thanh công cụ, bảng và phân trang của một bảng đơn (phần dưới tiêu đề của mục).
 * @param props  xem FormTableProps
 * @returns      thanh công cụ, bảng, thanh phân trang
 */
export function FormTable<Row extends FormSummary>({
  tableId,
  fields,
  rows,
  isPending,
  errorMessage,
  searchPlaceholder,
  searchLabel,
  emptyText,
  groupStartKey,
  pageLabel = PAGE_LABEL.profile,
  renderCell: renderCustomCell,
}: FormTableProps<Row>) {
  const navigate = useNavigate();
  const { table, query, setQuery, sorting, setSorting, filterRules, setFilterRules, matchedCount, hasCriteria } =
    useTableTools({
      tableId,
      rows,
      fields,
      defaultSorting: DEFAULT_SORTING,
      pageSize: PAGE_SIZE,
      getRowId: (form) => form.code,
    });
  const pageRows = table.getRowModel().rows;
  const columnCount = fields.length + 2;

  // Các đơn đang mở xem nhanh (theo mã đơn)
  const [openCodes, setOpenCodes] = useState<ReadonlySet<string>>(new Set());
  const allOpen = pageRows.length > 0 && pageRows.every(({ original: form }) => openCodes.has(form.code));
  /** Mở / đóng xem nhanh của một đơn. */
  const toggleOpen = (code: string) =>
    setOpenCodes((previous) => {
      const next = new Set(previous);
      if (!next.delete(code)) next.add(code);
      return next;
    });
  /** Mở tất cả đơn của trang đang xem; đang mở hết thì đóng hết. */
  const toggleAll = () =>
    setOpenCodes((previous) => {
      const next = new Set(previous);
      pageRows.forEach(({ original: form }) => (allOpen ? next.delete(form.code) : next.add(form.code)));
      return next;
    });
  const groupClass = (key: string) => (key === groupStartKey ? tableStyles.groupStart : '');

  // Bấm dòng hoặc nhấn Enter khi dòng đang được chọn: mở trang chi tiết đơn (trang đó có nút "‹ Quay lại <pageLabel>")
  const openForm = (code: string) =>
    navigate(formPath(code), { state: { previousPageLabel: pageLabel } satisfies ReturnState });
  const openOnEnter = (event: KeyboardEvent<HTMLTableRowElement>, code: string) => {
    if (event.target !== event.currentTarget || event.key !== 'Enter') return;
    event.preventDefault();
    openForm(code);
  };

  /**
   * Một ô của dòng: 4 cột thông tin đơn có cách hiện riêng; cột thêm hiện chữ, ô trống ghi "—".
   * @param field  cột
   * @param form   đơn của dòng
   * @returns      thẻ <td>
   */
  const renderCell = (field: TableField<Row>, form: Row) => {
    const customCell = renderCustomCell?.(field, form, query);
    if (customCell) return customCell;
    if (field.key === 'code') {
      return (
        <td key={field.key} className={tableStyles.codeCell}>
          <Highlight text={form.code} query={query} />
        </td>
      );
    }
    if (field.key === 'submittedAt') {
      return (
        <td key={field.key} className={tableStyles.numberCell}>
          <Highlight text={formatDate(form.submittedAt)} query={query} />
        </td>
      );
    }
    if (field.key === 'status') {
      return (
        <td key={field.key}>
          <StatusPill status={form.status} query={query} />
        </td>
      );
    }
    const text = displayText(field, form);
    return (
      <td key={field.key} className={`${field.key === 'formType' ? '' : tableStyles.nameCell} ${groupClass(field.key)}`}>
        {text ? <Highlight text={text} query={query} /> : <span className={tableStyles.dash}>{EMPTY_TEXT}</span>}
      </td>
    );
  };

  return (
    <>
      <TableToolbar
        fields={fields}
        rows={rows}
        query={query}
        onQueryChange={setQuery}
        searchPlaceholder={searchPlaceholder}
        searchLabel={searchLabel}
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
              <th className={quickStyles.expandCell}>
                <button
                  type="button"
                  className={`${quickStyles.expand} ${allOpen ? quickStyles.open : ''}`}
                  aria-expanded={allOpen}
                  aria-label={allOpen ? 'Đóng xem nhanh tất cả đơn' : 'Mở xem nhanh tất cả đơn'}
                  title="Mở / đóng tất cả"
                  disabled={pageRows.length === 0}
                  onClick={toggleAll}
                >
                  ›
                </button>
              </th>
              {fields.map((field) => (
                <HeaderCell
                  key={field.key}
                  field={field}
                  sorting={sorting}
                  filterRules={filterRules}
                  className={groupClass(field.key)}
                />
              ))}
              <th>
                <span className="sr-only">Mở đơn</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {isPending ? (
              <MessageRow columnCount={columnCount} text="Đang tải danh sách đơn…" />
            ) : errorMessage ? (
              <tr>
                <td colSpan={columnCount} className={tableStyles.messageCell}>
                  <LoadError message={errorMessage} />
                </td>
              </tr>
            ) : pageRows.length === 0 ? (
              <MessageRow
                columnCount={columnCount}
                text={hasCriteria ? 'Không có đơn nào khớp điều kiện tìm kiếm và bộ lọc.' : emptyText}
              />
            ) : (
              pageRows.map(({ original: form }) => {
                const isOpen = openCodes.has(form.code);
                return (
                  <Fragment key={form.code}>
                    <tr
                      className={tableStyles.rowLink}
                      tabIndex={0}
                      onClick={() => openForm(form.code)}
                      onKeyDown={(event) => openOnEnter(event, form.code)}
                    >
                      <td className={quickStyles.expandCell}>
                        <button
                          type="button"
                          className={`${quickStyles.expand} ${isOpen ? quickStyles.open : ''}`}
                          aria-expanded={isOpen}
                          aria-label={`Xem nhanh đơn ${form.code}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            toggleOpen(form.code);
                          }}
                        >
                          ›
                        </button>
                      </td>
                      {fields.map((field) => renderCell(field, form))}
                      <td className={tableStyles.goCell}>
                        <span className={tableStyles.goLabel}>Chi tiết ›</span>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr>
                        <td className={quickStyles.detailCell} />
                        <td colSpan={fields.length + 1} className={quickStyles.detailCell}>
                          <QuickView code={form.code} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })
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
    </>
  );
}

/**
 * Một dòng chữ chiếm cả bề ngang bảng: đang tải, hoặc không có đơn.
 * @param columnCount  số cột của bảng
 * @param text         câu cần hiện
 * @returns            thẻ <tr>
 */
function MessageRow({ columnCount, text }: { columnCount: number; text: string }) {
  return (
    <tr>
      <td colSpan={columnCount} className={tableStyles.messageCell}>
        {text}
      </td>
    </tr>
  );
}
