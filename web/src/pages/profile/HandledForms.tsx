/* Mục "Đơn phụ trách" trên trang Thông tin cá nhân của cán bộ (như handledTable trong artifact/js/profile.js):
   mọi đơn mình là người tiếp nhận hoặc người xử lí. Bên phải bảng có 2 cột Người tiếp nhận / Người xử lí,
   ngăn bằng đường kẻ dọc. Chỉ vai trò có quyền decide mới có mục này. */
import type { HandledFormSummary } from '@ulaw/shared';
import { useHandledForms } from '../../api/forms';
import type { TableField } from '../../components/table/tableTools';
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
 * Mục "Đơn phụ trách".
 * @returns  khung có tiêu đề và bảng đơn phụ trách
 */
export function HandledForms() {
  const formsQuery = useHandledForms();

  return (
    <section className={`${styles.card} ${styles.tableCard}`} aria-labelledby="handled-forms-title">
      <div className={styles.sectionHead}>
        <h2 id="handled-forms-title">Đơn phụ trách</h2>
      </div>

      <FormTable
        tableId="profile.handledForms"
        fields={HANDLED_FORM_FIELDS}
        rows={formsQuery.data ?? NO_FORMS}
        isPending={formsQuery.isPending}
        errorMessage={formsQuery.isError ? formsQuery.error.message : null}
        searchPlaceholder="Tìm theo mã đơn, trạng thái, người tiếp nhận, người xử lí"
        searchLabel="Tìm đơn phụ trách"
        emptyText="Bạn chưa tiếp nhận hay phụ trách đơn nào."
        groupStartKey="receiver"
      />
    </section>
  );
}
