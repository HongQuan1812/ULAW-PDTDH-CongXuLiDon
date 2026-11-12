/* Mục "Đơn phụ trách": mọi đơn một cán bộ là người tiếp nhận hoặc người xử lí,
   tải từng trang. Bên phải bảng có 2 cột Người tiếp nhận / Người xử lí, ngăn bằng đường kẻ dọc.
   Có ở trang Thông tin cá nhân của cán bộ (vai trò có quyền decide), và ở trang thông tin của một cán bộ khác
   khi người xem có quyền viewAll. */
import { useMemo } from 'react';
import { HANDLED_FORM_LIST_FIELDS, type HandledFormSummary } from '@ulaw/shared';
import { HANDLED_FORMS_SOURCE } from '../../api/forms';
import type { ListSource } from '../../api/lists';
import { personHandledFormsSource } from '../../api/profile';
import { RefreshButton } from '../../components/RefreshButton';
import { useServerTable } from '../../components/table/useServerTable';
import { FORM_PAGE_SIZE, FormTable } from './FormTable';
import styles from './ProfilePage.module.css';

/**
 * Mục "Đơn phụ trách" của chính mình.
 * @returns  khung có tiêu đề và bảng đơn phụ trách
 */
export function HandledForms() {
  return (
    <HandledFormsSection
      source={HANDLED_FORMS_SOURCE}
      tableId="profile.handledForms"
      emptyText="Bạn chưa tiếp nhận hay phụ trách đơn nào."
    />
  );
}

/**
 * Mục "Đơn phụ trách" của một cán bộ khác (trang thông tin người khác).
 * @param userId     id cán bộ
 * @param pageLabel  tên trang đang xem, để trang chi tiết đơn có nút "‹ Quay lại <tên trang>"
 * @returns          khung có tiêu đề và bảng đơn phụ trách
 */
export function PersonHandledForms({ userId, pageLabel }: { userId: string; pageLabel: string }) {
  const source = useMemo(() => personHandledFormsSource(userId), [userId]);
  return (
    <HandledFormsSection
      source={source}
      tableId="person.handledForms"
      emptyText="Cán bộ này chưa tiếp nhận hay phụ trách đơn nào."
      pageLabel={pageLabel}
    />
  );
}

/**
 * Khung "Đơn phụ trách": tiêu đề, nút ↻ và bảng.
 * @param source     nguồn của bảng (đơn phụ trách của mình, hoặc của một cán bộ khác)
 * @param tableId    tên bảng, để nhớ cách xem
 * @param emptyText  câu khi chưa có đơn nào
 * @param pageLabel  tên trang đang xem (không bắt buộc), cho nút quay lại ở trang chi tiết đơn
 * @returns          khung có tiêu đề và bảng
 */
function HandledFormsSection({
  source,
  tableId,
  emptyText,
  pageLabel,
}: {
  source: ListSource<HandledFormSummary>;
  tableId: string;
  emptyText: string;
  pageLabel?: string;
}) {
  const formsTable = useServerTable({ tableId, source, pageSize: FORM_PAGE_SIZE });

  return (
    <section className={`${styles.card} ${styles.tableCard}`} aria-labelledby="handled-forms-title">
      <div className={styles.sectionHead}>
        <div className={styles.titleGroup}>
          <h2 id="handled-forms-title">Đơn phụ trách</h2>
          <RefreshButton query={formsTable.pageQuery} label="Đơn phụ trách" size="small" />
        </div>
      </div>

      <FormTable
        table={formsTable}
        fields={HANDLED_FORM_LIST_FIELDS}
        searchPlaceholder="Tìm theo mã đơn, trạng thái, người tiếp nhận, người xử lí"
        searchLabel="Tìm đơn phụ trách"
        emptyText={emptyText}
        groupStartKey="receiver"
        pageLabel={pageLabel}
      />
    </section>
  );
}
