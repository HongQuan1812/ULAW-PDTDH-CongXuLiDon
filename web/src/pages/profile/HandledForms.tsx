/* Mục "Đơn phụ trách" (như handledTable trong artifact/js/profile.js): mọi đơn một cán bộ là người tiếp nhận hoặc người xử lí.
   Bên phải bảng có 2 cột Người tiếp nhận / Người xử lí, ngăn bằng đường kẻ dọc.
   Có ở trang Thông tin cá nhân của cán bộ (vai trò có quyền decide), và ở trang thông tin của một cán bộ khác
   khi người xem có quyền viewAll. */
import type { UseQueryResult } from '@tanstack/react-query';
import type { HandledFormSummary } from '@ulaw/shared';
import { useHandledForms } from '../../api/forms';
import { usePersonHandledForms } from '../../api/profile';
import type { TableField } from '../../components/table/tableTools';
import { loadErrorMessage } from '../../components/LoadError';
import { RefreshButton } from '../../components/RefreshButton';
import { BASE_FORM_FIELDS, FormTable } from './FormTable';
import styles from './ProfilePage.module.css';

/** Các cột: thông tin đơn, rồi Người tiếp nhận, Người xử lí (lọc chọn theo tên cán bộ có trong dữ liệu). */
const HANDLED_FORM_FIELDS: TableField<HandledFormSummary>[] = [
  ...BASE_FORM_FIELDS,
  {
    key: 'receiver',
    label: 'Người tiếp nhận',
    type: 'select',
    getValue: (form) => form.receiver?.id ?? null,
    getLabel: (form) => form.receiver?.name ?? '',
  },
  {
    key: 'handler',
    label: 'Người xử lí',
    type: 'select',
    getValue: (form) => form.handler?.id ?? null,
    getLabel: (form) => form.handler?.name ?? '',
  },
];

/** Mảng rỗng dùng chung khi chưa tải xong, để bảng không bị tính lại mỗi lần vẽ. */
const NO_FORMS: HandledFormSummary[] = [];

/**
 * Mục "Đơn phụ trách" của chính mình.
 * @returns  khung có tiêu đề và bảng đơn phụ trách
 */
export function HandledForms() {
  return (
    <HandledFormsSection
      formsQuery={useHandledForms()}
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
  return (
    <HandledFormsSection
      formsQuery={usePersonHandledForms(userId, true)}
      tableId="person.handledForms"
      emptyText="Cán bộ này chưa tiếp nhận hay phụ trách đơn nào."
      pageLabel={pageLabel}
    />
  );
}

/**
 * Khung "Đơn phụ trách": tiêu đề, nút ↻ và bảng.
 * @param formsQuery  kết quả tải các đơn phụ trách
 * @param tableId     tên bảng, để nhớ cách xem
 * @param emptyText   câu khi chưa có đơn nào
 * @param pageLabel   tên trang đang xem (không bắt buộc), cho nút quay lại ở trang chi tiết đơn
 * @returns           khung có tiêu đề và bảng
 */
function HandledFormsSection({
  formsQuery,
  tableId,
  emptyText,
  pageLabel,
}: {
  formsQuery: UseQueryResult<HandledFormSummary[]>;
  tableId: string;
  emptyText: string;
  pageLabel?: string;
}) {
  return (
    <section className={`${styles.card} ${styles.tableCard}`} aria-labelledby="handled-forms-title">
      <div className={styles.sectionHead}>
        <div className={styles.titleGroup}>
          <h2 id="handled-forms-title">Đơn phụ trách</h2>
          <RefreshButton query={formsQuery} label="Đơn phụ trách" size="small" />
        </div>
      </div>

      <FormTable
        tableId={tableId}
        fields={HANDLED_FORM_FIELDS}
        rows={formsQuery.data ?? NO_FORMS}
        isPending={formsQuery.isPending}
        errorMessage={loadErrorMessage(formsQuery)}
        searchPlaceholder="Tìm theo mã đơn, trạng thái, người tiếp nhận, người xử lí"
        searchLabel="Tìm đơn phụ trách"
        emptyText={emptyText}
        groupStartKey="receiver"
        pageLabel={pageLabel}
      />
    </section>
  );
}
