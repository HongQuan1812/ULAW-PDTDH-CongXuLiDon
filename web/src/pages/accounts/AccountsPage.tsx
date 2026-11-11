/* Trang Quản lí tài khoản (#/quan-li-tai-khoan, chỉ Admin), như artifact/js/accounts-page.js.
   Bảng mọi tài khoản (người nộp đơn và cán bộ): họ tên (tài khoản của mình có nhãn "Bạn"), email, vai trò, SĐT, CCCD;
   tìm kiếm / Sắp xếp / Lọc / phân trang dùng chung với các bảng khác, mặc định xếp theo họ tên A → Z.
   Bấm một dòng: mở trang thông tin của tài khoản đó (dòng của mình → Thông tin cá nhân). Nút Sửa cuối dòng, nút "+ Tạo tài khoản",
   nút Hiện CCCD ở đầu thẻ. */
import { useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router';
import { ROLES, ROLE_IDS, type Account, type RoleId } from '@ulaw/shared';
import { useAccountCccds, useAccounts } from '../../api/accounts';
import { PAGE_LABEL, PAGE_PATH, personProfilePath, type ReturnState } from '../../app/paths';
import { Button } from '../../components/Button';
import { LoadError, loadErrorMessage } from '../../components/LoadError';
import { RefreshButton } from '../../components/RefreshButton';
import { useToast } from '../../components/Toast';
import { HeaderCell } from '../../components/table/HeaderCell';
import { Highlight } from '../../components/table/Highlight';
import { Pager } from '../../components/table/Pager';
import { TableToolbar } from '../../components/table/TableToolbar';
import { displayText, type SortRules, type TableField } from '../../components/table/tableTools';
import { useTableTools } from '../../components/table/useTableTools';
import { AccountDialog } from '../../features/accounts/AccountDialog';
import { useAuth } from '../../features/auth/useAuth';
import { EMPTY_TEXT, formatPhone } from '../../lib/format';
import tableStyles from '../../components/table/table.module.css';
import profileStyles from '../profile/ProfilePage.module.css';
import styles from './AccountsPage.module.css';

/** Các cột, như U_FIELDS của bản mẫu. */
const ACCOUNT_FIELDS: TableField<Account>[] = [
  { key: 'name', label: 'Họ và tên', type: 'text', getValue: (account) => account.name },
  { key: 'email', label: 'Email', type: 'text', getValue: (account) => account.email },
  {
    key: 'role',
    label: 'Vai trò',
    type: 'select',
    getValue: (account) => account.role,
    getLabel: (account) => ROLES[account.role].name,
    options: ROLE_IDS.map((roleId) => ({ value: roleId, label: ROLES[roleId].name })),
    getOrder: (account) => ROLE_IDS.indexOf(account.role),
  },
  { key: 'phone', label: 'Số điện thoại', type: 'text', getValue: (account) => (account.phone ? formatPhone(account.phone) : null) },
  { key: 'cccd', label: 'Số CCCD', type: 'text', getValue: (account) => account.maskedCccd },
];

/** Thứ tự khi chưa chọn sắp xếp: họ tên A → Z. */
const DEFAULT_SORTING: SortRules = [{ id: 'name', desc: false }];

/** Số tài khoản mỗi trang, như U_PER của bản mẫu. */
const PAGE_SIZE = 10;

/** Tên bảng, để nhớ cách xem khi đi qua trang khác rồi quay lại. */
const TABLE_ID = 'accounts.all';

/** Mảng rỗng dùng chung khi chưa tải xong, để bảng không bị tính lại mỗi lần vẽ. */
const NO_ACCOUNTS: Account[] = [];

/** Số cột của bảng: các cột dữ liệu và cột nút Sửa. */
const COLUMN_COUNT = ACCOUNT_FIELDS.length + 1;

/** Câu báo khi không tải được số CCCD mà máy chủ không gửi kèm câu báo lỗi (vd mất mạng). */
const CCCD_FAILED_TEXT = 'Chưa tải được số CCCD. Kiểm tra kết nối mạng rồi bấm Hiện CCCD lại.';

/**
 * Trang Quản lí tài khoản.
 * @returns  thẻ bảng tài khoản: tiêu đề, nút ↻, Hiện CCCD và "+ Tạo tài khoản" ở đầu thẻ; hộp tạo / sửa tài khoản
 */
export function AccountsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const accountsQuery = useAccounts();
  const [showCccd, setShowCccd] = useState(false);
  const cccdsQuery = useAccountCccds(showCccd);
  // Hộp tạo / sửa: null = đóng; account null = tạo mới
  const [dialog, setDialog] = useState<{ account: Account | null } | null>(null);

  // Đang hiện CCCD thì thay số che bằng số đầy đủ (tài khoản chưa có CCCD giữ nguyên null)
  const revealed = showCccd && cccdsQuery.data ? cccdsQuery.data : null;
  const rows = useMemo(() => {
    const accounts = accountsQuery.data ?? NO_ACCOUNTS;
    if (!revealed) return accounts;
    return accounts.map((account) => ({ ...account, maskedCccd: revealed[account.id] ?? account.maskedCccd }));
  }, [accountsQuery.data, revealed]);

  // Tải CCCD lỗi thì báo và tự ẩn lại (bấm Hiện CCCD để thử lần nữa)
  const cccdsError = cccdsQuery.isError ? cccdsQuery.error : null;
  useEffect(() => {
    if (!cccdsError) return;
    toast(cccdsError.message || CCCD_FAILED_TEXT, 'error');
    setShowCccd(false);
  }, [cccdsError, toast]);

  const { table, query, setQuery, sorting, setSorting, filterRules, setFilterRules, matchedCount, hasCriteria } = useTableTools({
    tableId: TABLE_ID,
    rows,
    fields: ACCOUNT_FIELDS,
    defaultSorting: DEFAULT_SORTING,
    pageSize: PAGE_SIZE,
    getRowId: (account) => account.id,
  });
  const pageRows = table.getRowModel().rows;
  const errorMessage = loadErrorMessage(accountsQuery);

  // Bấm dòng (hoặc Enter trên dòng đang chọn): mở trang thông tin của tài khoản; dòng của mình → Thông tin cá nhân.
  // Trang mở ra có nút "‹ Quay lại Quản lí tài khoản"
  const openAccount = (account: Account) =>
    navigate(account.id === user.id ? PAGE_PATH.profile : personProfilePath(account.id), {
      state: { previousPageLabel: PAGE_LABEL.accounts } satisfies ReturnState,
    });
  const openOnEnter = (event: KeyboardEvent<HTMLTableRowElement>, account: Account) => {
    if (event.target !== event.currentTarget || event.key !== 'Enter') return;
    event.preventDefault();
    openAccount(account);
  };

  /**
   * Vừa tạo tài khoản: bỏ lọc, tìm theo email của tài khoản đó để bảng hiện ngay dòng vừa tạo.
   * @param account  tài khoản vừa tạo
   */
  const showCreated = (account: Account) => {
    setFilterRules([]);
    setQuery(account.email);
  };

  return (
    <div className={profileStyles.page}>
      <section className={`${profileStyles.card} ${profileStyles.tableCard}`} aria-labelledby="accounts-title">
        <div className={profileStyles.sectionHead}>
          <div className={profileStyles.titleGroup}>
            <h1 id="accounts-title" className={styles.title}>
              Quản lí tài khoản
            </h1>
            <RefreshButton query={accountsQuery} label="Quản lí tài khoản" size="small" />
          </div>
          <div className={styles.headActions}>
            <Button aria-pressed={showCccd} onClick={() => setShowCccd((isShown) => !isShown)} disabled={showCccd && cccdsQuery.isPending}>
              {showCccd ? (cccdsQuery.isPending ? 'Đang tải…' : 'Ẩn CCCD') : 'Hiện CCCD'}
            </Button>
            <Button variant="primary" onClick={() => setDialog({ account: null })}>
              + Tạo tài khoản
            </Button>
          </div>
        </div>

        <TableToolbar
          fields={ACCOUNT_FIELDS}
          rows={rows}
          query={query}
          onQueryChange={setQuery}
          searchPlaceholder="Tìm theo họ tên, email, vai trò, số điện thoại, CCCD"
          searchLabel="Tìm tài khoản"
          sorting={sorting}
          onSortingChange={setSorting}
          defaultSortNote="Bảng đang xếp theo họ tên A → Z."
          filterRules={filterRules}
          onFilterRulesChange={setFilterRules}
          defaultFilterKey="role"
        />

        <div className={tableStyles.tableWrap}>
          <table className={tableStyles.table}>
            <thead>
              <tr>
                {ACCOUNT_FIELDS.map((field) => (
                  <HeaderCell key={field.key} field={field} sorting={sorting} filterRules={filterRules} />
                ))}
                <th>
                  <span className="sr-only">Sửa tài khoản</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {accountsQuery.isPending ? (
                <MessageRow text="Đang tải danh sách tài khoản…" />
              ) : errorMessage ? (
                <tr>
                  <td colSpan={COLUMN_COUNT} className={tableStyles.messageCell}>
                    <LoadError message={errorMessage} />
                  </td>
                </tr>
              ) : pageRows.length === 0 ? (
                <MessageRow text={hasCriteria ? 'Không có tài khoản nào khớp điều kiện tìm kiếm và bộ lọc.' : 'Chưa có tài khoản nào.'} />
              ) : (
                pageRows.map(({ original: account }) => (
                  <tr
                    key={account.id}
                    className={tableStyles.rowLink}
                    tabIndex={0}
                    onClick={() => openAccount(account)}
                    onKeyDown={(event) => openOnEnter(event, account)}
                  >
                    {ACCOUNT_FIELDS.map((field) => (
                      <AccountCell key={field.key} field={field} account={account} query={query} isMe={account.id === user.id} />
                    ))}
                    <td className={tableStyles.goCell}>
                      <Button
                        className={styles.editButton}
                        aria-label={`Sửa tài khoản ${account.name}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          setDialog({ account });
                        }}
                      >
                        Sửa
                      </Button>
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
          unit="tài khoản"
          onPageChange={table.setPageIndex}
        />
      </section>

      <AccountDialog open={dialog !== null} account={dialog?.account ?? null} onClose={() => setDialog(null)} onCreated={showCreated} />
    </div>
  );
}

/**
 * Một ô của bảng tài khoản: họ tên in đậm (kèm nhãn "Bạn"), vai trò là nhãn màu, SĐT và CCCD kiểu số; ô trống ghi "—".
 * @param field    cột
 * @param account  tài khoản của dòng
 * @param query    chữ đang tìm, để tô sáng
 * @param isMe     dòng là tài khoản của người đang đăng nhập
 * @returns        thẻ <td>
 */
function AccountCell({ field, account, query, isMe }: { field: TableField<Account>; account: Account; query: string; isMe: boolean }) {
  if (field.key === 'role') {
    return (
      <td>
        <RolePill role={account.role} query={query} />
      </td>
    );
  }
  const text = displayText(field, account);
  const cellClass = field.key === 'name' ? tableStyles.nameCell : field.key === 'phone' || field.key === 'cccd' ? styles.numberText : '';
  return (
    <td className={cellClass}>
      {!text ? (
        <span className={tableStyles.dash}>{EMPTY_TEXT}</span>
      ) : field.key === 'name' || field.key === 'email' ? (
        // Họ tên, email: dài quá thì xuống dòng; nhãn "Bạn" đi liền sau họ tên
        <span className={tableStyles.wrapText}>
          <Highlight text={text} query={query} />
          {field.key === 'name' && isMe && <span className={styles.you}>Bạn</span>}
        </span>
      ) : (
        <Highlight text={text} query={query} />
      )}
    </td>
  );
}

/**
 * Nhãn vai trò, đậm nhạt theo màu trường: Người nộp đơn xám, Người xử lí đơn xanh nhạt, Admin xanh đậm.
 * @param role   vai trò
 * @param query  chữ đang tìm, để tô sáng
 * @returns      thẻ <span>
 */
function RolePill({ role, query }: { role: RoleId; query: string }) {
  return (
    <span className={`${styles.rolePill} ${styles[`role_${role}`]}`}>
      <Highlight text={ROLES[role].name} query={query} />
    </span>
  );
}

/**
 * Một dòng chữ chiếm cả bề ngang bảng: đang tải, hoặc không có tài khoản.
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
