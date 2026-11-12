/* Trang Quản lí tài khoản (#/quan-li-tai-khoan, chỉ Admin).
   Bảng mọi tài khoản (người nộp đơn và cán bộ): họ tên (tài khoản của mình có nhãn "Bạn"), email, vai trò, SĐT, CCCD;
   tìm kiếm / Sắp xếp / Lọc / phân trang dùng chung với các bảng khác, mặc định xếp theo họ tên A → Z.
   Bấm một dòng: mở trang thông tin của tài khoản đó (dòng của mình → Thông tin cá nhân). Nút Sửa cuối dòng, nút "+ Tạo tài khoản" ở đầu thẻ,
   nút Hiện CCCD trên thanh công cụ (sau nút Lọc). */
import { useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router';
import { ACCOUNT_LIST_FIELDS, ROLES, type Account, type RoleId } from '@ulaw/shared';
import { ACCOUNTS_SOURCE, useAccountCccds } from '../../api/accounts';
import { PAGE_LABEL, PAGE_PATH, personProfilePath, type ReturnState } from '../../app/paths';
import { Button } from '../../components/Button';
import { LoadError } from '../../components/LoadError';
import { RefreshButton } from '../../components/RefreshButton';
import { useToast } from '../../components/Toast';
import { HeaderCell } from '../../components/table/HeaderCell';
import { Highlight } from '../../components/table/Highlight';
import { Pager } from '../../components/table/Pager';
import { TableToolbar } from '../../components/table/TableToolbar';
import { displayText, type TableField } from '../../components/table/tableTools';
import { CccdToggleButton } from '../../components/table/CccdToggleButton';
import { useServerTable } from '../../components/table/useServerTable';
import { AccountDialog } from '../../features/accounts/AccountDialog';
import { useAuth } from '../../features/auth/useAuth';
import { EMPTY_TEXT } from '../../lib/format';
import tableStyles from '../../components/table/table.module.css';
import profileStyles from '../profile/ProfilePage.module.css';
import styles from './AccountsPage.module.css';

/** Số tài khoản mỗi trang (cũng là số tài khoản mỗi lần tải). */
const PAGE_SIZE = 10;

/** Tên bảng, để nhớ cách xem khi đi qua trang khác rồi quay lại. */
const TABLE_ID = 'accounts.all';

/** Số cột của bảng: các cột dữ liệu (ACCOUNT_LIST_FIELDS) và cột nút Sửa. */
const COLUMN_COUNT = ACCOUNT_LIST_FIELDS.length + 1;

/** Câu báo khi không tải được số CCCD mà máy chủ không gửi kèm câu báo lỗi (vd mất mạng). */
const CCCD_FAILED_TEXT = 'Chưa tải được số CCCD. Kiểm tra kết nối mạng rồi bấm Hiện CCCD lại.';

/**
 * Trang Quản lí tài khoản.
 * @returns  thẻ bảng tài khoản: tiêu đề, nút ↻ và "+ Tạo tài khoản" ở đầu thẻ; thanh công cụ (có Hiện CCCD); hộp tạo / sửa tài khoản
 */
export function AccountsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const accountsTable = useServerTable({ tableId: TABLE_ID, source: ACCOUNTS_SOURCE, pageSize: PAGE_SIZE });
  const { searchText: query, sorting, filterRules, hasCriteria, isPageLoading, errorMessage } = accountsTable;
  // Hộp tạo / sửa: null = đóng; account null = tạo mới
  const [dialog, setDialog] = useState<{ account: Account | null } | null>(null);

  // Hiện CCCD: chỉ tải CCCD của các tài khoản đang có trên trang bảng
  const [showCccd, setShowCccd] = useState(false);
  const pageAccounts = accountsTable.rows;
  const cccdsQuery = useAccountCccds(showCccd, pageAccounts.map((account) => account.id));

  // Đang hiện CCCD thì thay số che bằng số đầy đủ (tài khoản chưa có CCCD giữ nguyên null)
  const revealed = showCccd && cccdsQuery.data ? cccdsQuery.data : null;
  const pageRows = useMemo(() => {
    if (!revealed) return pageAccounts;
    return pageAccounts.map((account) => ({ ...account, maskedCccd: revealed[account.id] ?? account.maskedCccd }));
  }, [pageAccounts, revealed]);

  // Tải CCCD lỗi thì báo và tự ẩn lại (bấm Hiện CCCD để thử lần nữa)
  const cccdsError = cccdsQuery.isError ? cccdsQuery.error : null;
  useEffect(() => {
    if (!cccdsError) return;
    toast(cccdsError.message || CCCD_FAILED_TEXT, 'error');
    setShowCccd(false);
  }, [cccdsError, toast]);

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
    accountsTable.setFilterRules([]);
    accountsTable.setQuery(account.email);
  };

  return (
    <div className={profileStyles.page}>
      <section className={`${profileStyles.card} ${profileStyles.tableCard}`} aria-labelledby="accounts-title">
        <div className={profileStyles.sectionHead}>
          <div className={profileStyles.titleGroup}>
            <h1 id="accounts-title" className={styles.title}>
              Quản lí tài khoản
            </h1>
            <RefreshButton query={accountsTable.pageQuery} label="Quản lí tài khoản" size="small" />
          </div>
          <Button variant="primary" onClick={() => setDialog({ account: null })}>
            + Tạo tài khoản
          </Button>
        </div>

        <TableToolbar
          fields={ACCOUNT_LIST_FIELDS}
          filterOptions={accountsTable.filterOptions}
          query={accountsTable.query}
          onQueryChange={accountsTable.setQuery}
          searchPlaceholder="Tìm theo họ tên, email, vai trò, số điện thoại, CCCD"
          searchLabel="Tìm tài khoản"
          sorting={sorting}
          onSortingChange={accountsTable.setSorting}
          defaultSortNote="Bảng đang xếp theo họ tên A → Z."
          filterRules={filterRules}
          onFilterRulesChange={accountsTable.setFilterRules}
          defaultFilterKey="role"
          extraButtons={
            <CccdToggleButton
              shown={showCccd}
              loading={showCccd && cccdsQuery.isFetching}
              onToggle={() => setShowCccd((isShown) => !isShown)}
            />
          }
        />

        {/* Đang chờ trang mới: trang cũ mờ đi, không bấm được, có vạch tải ở mép trên bảng */}
        <div className={`${tableStyles.tableWrap} ${isPageLoading ? tableStyles.pageLoading : ''}`}>
          <table className={tableStyles.table} aria-busy={isPageLoading}>
            <thead>
              <tr>
                {ACCOUNT_LIST_FIELDS.map((field) => (
                  <HeaderCell key={field.key} field={field} sorting={sorting} filterRules={filterRules} />
                ))}
                <th>
                  <span className="sr-only">Sửa tài khoản</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {accountsTable.isFirstLoad ? (
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
                pageRows.map((account) => (
                  <tr
                    key={account.id}
                    className={tableStyles.rowLink}
                    tabIndex={0}
                    onClick={() => openAccount(account)}
                    onKeyDown={(event) => openOnEnter(event, account)}
                  >
                    {ACCOUNT_LIST_FIELDS.map((field) => (
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
          pageIndex={accountsTable.pageIndex}
          pageCount={accountsTable.pageCount}
          pageSize={PAGE_SIZE}
          total={accountsTable.total}
          unit="tài khoản"
          onPageChange={accountsTable.setPageIndex}
          loading={isPageLoading}
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
