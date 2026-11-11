/* Trang Quản lí loại đơn (#/quan-li-loai-don), như phần "Danh sách loại đơn" của artifact/js/forms-page.js.
   Bảng mọi loại đơn, mỗi mã đơn một dòng theo phiên bản mới nhất: tên, mã đơn, phiên bản, trạng thái, lần lưu gần nhất;
   tìm kiếm / Sắp xếp / Lọc / phân trang dùng chung với các bảng khác. Nút › đầu dòng xổ ra các phiên bản cũ hơn.
   Mặc định xếp theo trạng thái (Đang mở → Nháp → Đã đóng) rồi theo tên. Bấm một dòng để mở trình soạn ở phiên bản đó;
   "+ Tạo loại đơn" mở trình soạn trống. */
import { Fragment, useState, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router';
import { FORM_TYPE_STATUSES, FORM_TYPE_STATUS_LABEL, type FormTypeStatus, type FormTypeSummary } from '@ulaw/shared';
import { useFormTypes } from '../../api/form-types';
import { NEW_FORM_TYPE_ID, PAGE_LABEL, formTypeEditorPath, type ReturnState } from '../../app/paths';
import { Button } from '../../components/Button';
import { LoadError, loadErrorMessage } from '../../components/LoadError';
import { RefreshButton } from '../../components/RefreshButton';
import { FormTypeStatusPill } from '../../components/StatusPill';
import { discardTemplateChanges, discardUnsavedEdit, hasUnsavedEdit } from '../form-editor/formTypeDrafts';
import { HeaderCell } from '../../components/table/HeaderCell';
import { Highlight } from '../../components/table/Highlight';
import { Pager } from '../../components/table/Pager';
import { TableToolbar } from '../../components/table/TableToolbar';
import { displayText, type SortRules, type TableField } from '../../components/table/tableTools';
import { useTableTools } from '../../components/table/useTableTools';
import { EMPTY_TEXT } from '../../lib/format';
import tableStyles from '../../components/table/table.module.css';
import profileStyles from '../profile/ProfilePage.module.css';
import quickStyles from '../profile/QuickView.module.css';
import styles from './FormTypesPage.module.css';

/** Thứ tự trạng thái khi sắp xếp tăng dần, như FM_ORDER của bản mẫu: Đang mở → Nháp → Đã đóng. */
const STATUS_ORDER: Record<FormTypeStatus, number> = { open: 0, draft: 1, closed: 2 };

/** Các cột, như FM_FIELDS của bản mẫu, thêm cột Phiên bản. */
const FORM_TYPE_FIELDS: TableField<FormTypeSummary>[] = [
  { key: 'name', label: 'Tên loại đơn', type: 'text', getValue: (formType) => formType.name },
  { key: 'prefix', label: 'Mã đơn', type: 'text', getValue: (formType) => formType.prefix },
  { key: 'version', label: 'Phiên bản', type: 'number', getValue: (formType) => formType.version },
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

/** Số cột của bảng: cột nút ›, các cột dữ liệu và cột "Soạn ›". */
const COLUMN_COUNT = FORM_TYPE_FIELDS.length + 2;

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
  // Các loại đơn đang xổ ra phiên bản cũ
  const [expandedIds, setExpandedIds] = useState<ReadonlySet<string>>(new Set());

  /**
   * Xổ ra / thu lại các phiên bản cũ của một loại đơn.
   * @param formTypeId  mã loại đơn
   */
  const toggleExpanded = (formTypeId: string) =>
    setExpandedIds((current) => {
      const next = new Set(current);
      if (!next.delete(formTypeId)) next.add(formTypeId);
      return next;
    });

  // Nút ở đầu bảng: xổ ra / thu lại mọi loại đơn có phiên bản cũ trong trang đang xem (như nút mở xem nhanh tất cả của bảng đơn)
  const expandableIds = pageRows.filter(({ original: formType }) => formType.olderVersions.length > 0).map(({ original: formType }) => formType.id);
  const allExpanded = expandableIds.length > 0 && expandableIds.every((formTypeId) => expandedIds.has(formTypeId));
  /** Xổ ra hết các loại đơn có phiên bản cũ của trang đang xem; đang xổ hết thì thu lại hết. */
  const toggleAllExpanded = () =>
    setExpandedIds((current) => {
      const next = new Set(current);
      expandableIds.forEach((formTypeId) => (allExpanded ? next.delete(formTypeId) : next.add(formTypeId)));
      return next;
    });

  // Mở trình soạn (trang soạn có nút "‹ Quay lại Quản lí loại đơn") ở phiên bản của dòng; Enter trên dòng đang chọn cũng mở
  const openEditor = (formTypeId: string, version?: number) =>
    navigate(formTypeEditorPath(formTypeId, version), { state: { previousPageLabel: PAGE_LABEL.formTypes } satisfies ReturnState });
  const openOnEnter = (event: KeyboardEvent<HTMLTableRowElement>, formTypeId: string, version?: number) => {
    if (event.target !== event.currentTarget || event.key !== 'Enter') return;
    event.preventDefault();
    openEditor(formTypeId, version);
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
          <Button
            variant="primary"
            onClick={() => {
              discardUnsavedEdit(NEW_FORM_TYPE_ID);
              discardTemplateChanges(NEW_FORM_TYPE_ID);
              openEditor(NEW_FORM_TYPE_ID);
            }}
          >
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
                <th className={quickStyles.expandCell}>
                  <button
                    type="button"
                    className={`${quickStyles.expand} ${allExpanded ? quickStyles.open : ''}`}
                    aria-expanded={allExpanded}
                    aria-label={allExpanded ? 'Thu lại phiên bản cũ của tất cả loại đơn' : 'Xem phiên bản cũ của tất cả loại đơn'}
                    title="Mở / đóng tất cả"
                    disabled={expandableIds.length === 0}
                    onClick={toggleAllExpanded}
                  >
                    ›
                  </button>
                </th>
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
                pageRows.map(({ original: formType }) => {
                  const isExpanded = expandedIds.has(formType.id);
                  const olderCount = formType.olderVersions.length;
                  return (
                    <Fragment key={formType.id}>
                      <tr
                        className={tableStyles.rowLink}
                        tabIndex={0}
                        onClick={() => openEditor(formType.id)}
                        onKeyDown={(event) => openOnEnter(event, formType.id)}
                      >
                        <td className={quickStyles.expandCell}>
                          <button
                            type="button"
                            className={`${quickStyles.expand} ${isExpanded ? quickStyles.open : ''}`}
                            aria-expanded={isExpanded}
                            aria-label={olderCount ? `Xem ${olderCount} phiên bản cũ của ${formType.name}` : `${formType.name} chưa có phiên bản cũ`}
                            title={olderCount ? `${olderCount} phiên bản cũ` : 'Chưa có phiên bản cũ'}
                            disabled={!olderCount}
                            onClick={(event) => {
                              event.stopPropagation();
                              toggleExpanded(formType.id);
                            }}
                          >
                            ›
                          </button>
                        </td>
                        {FORM_TYPE_FIELDS.map((field) => (
                          <FormTypeCell key={field.key} field={field} formType={formType} query={query} showUnsavedNote />
                        ))}
                        <td className={tableStyles.goCell}>
                          <span className={tableStyles.goLabel}>Soạn ›</span>
                        </td>
                      </tr>

                      {/* Các phiên bản cũ, mới trước: cùng các cột, nền nhạt; bấm để mở trình soạn ở phiên bản đó */}
                      {isExpanded &&
                        formType.olderVersions.map((olderVersion) => {
                          const versionRow: FormTypeSummary = { ...formType, ...olderVersion, olderVersions: [] };
                          return (
                            <tr
                              key={olderVersion.version}
                              className={`${tableStyles.rowLink} ${styles.olderRow}`}
                              tabIndex={0}
                              onClick={() => openEditor(formType.id, olderVersion.version)}
                              onKeyDown={(event) => openOnEnter(event, formType.id, olderVersion.version)}
                            >
                              <td className={quickStyles.expandCell} />
                              {FORM_TYPE_FIELDS.map((field) => (
                                <FormTypeCell key={field.key} field={field} formType={versionRow} query={query} showUnsavedNote={false} />
                              ))}
                              <td className={tableStyles.goCell}>
                                <span className={tableStyles.goLabel}>Xem ›</span>
                              </td>
                            </tr>
                          );
                        })}
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
          unit="loại đơn"
          onPageChange={table.setPageIndex}
        />
      </section>
    </div>
  );
}

/**
 * Một ô của bảng loại đơn: tên in đậm, mã đơn kiểu mã, trạng thái là nhãn màu, còn lại là chữ; ô trống ghi "—".
 * @param field            cột
 * @param formType         loại đơn của dòng (dòng phiên bản cũ: thông tin của phiên bản đó)
 * @param query            chữ đang tìm, để tô sáng
 * @param showUnsavedNote  true: ghi "Có thay đổi chưa lưu" cạnh tên khi trình soạn đang có thay đổi chưa lưu
 * @returns                thẻ <td>
 */
function FormTypeCell({
  field,
  formType,
  query,
  showUnsavedNote,
}: {
  field: TableField<FormTypeSummary>;
  formType: FormTypeSummary;
  query: string;
  showUnsavedNote: boolean;
}) {
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
      {!text ? (
        <span className={tableStyles.dash}>{EMPTY_TEXT}</span>
      ) : field.key === 'name' || field.key === 'updatedBy' ? (
        // Tên loại đơn, người cập nhật: dài quá thì xuống dòng (ghi chú "Có thay đổi chưa lưu" đi liền sau tên)
        <span className={tableStyles.wrapText}>
          <Highlight text={text} query={query} />
          {field.key === 'name' && showUnsavedNote && hasUnsavedEdit(formType.id) && <span className={styles.draftNote}>Có thay đổi chưa lưu</span>}
        </span>
      ) : (
        <Highlight text={text} query={query} />
      )}
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
