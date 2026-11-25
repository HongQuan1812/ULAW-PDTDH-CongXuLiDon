/* Mục Lịch sử trong khung "Thông tin đơn" ở trang chi tiết đơn: mỗi lần nộp, sửa, tiếp nhận, ra quyết định, chuyển giao một dòng, cũ nhất ở trên. */
import { FORM_EVENT_LABEL, type FormEvent } from '@ulaw/shared';
import { formatDateTime } from '../../lib/format';
import { INFO_SECTION_STORAGE_KEY, PanelSection } from './FormInfoPanel';
import styles from './FormHistory.module.css';

/**
 * Tên việc hiện trên dòng thời gian.
 * @param event  một dòng lịch sử
 * @returns      vd "Duyệt", "Chuyển giao cho Lê Thị Thu Hà"
 */
function eventTitle(event: FormEvent): string {
  const label = FORM_EVENT_LABEL[event.action];
  return event.action === 'transfer' && event.toStaff ? `${label} cho ${event.toStaff.name}` : label;
}

/**
 * Mục Lịch sử thu gọn được, có số dòng trên hàng tiêu đề.
 * @param history  lịch sử của đơn, cũ nhất trước
 * @returns        khối mục
 */
export function FormHistory({ history }: { history: readonly FormEvent[] }) {
  return (
    <PanelSection title="Lịch sử" count={history.length} storageKey={INFO_SECTION_STORAGE_KEY.history}>
      <ol className={styles.timeline}>
        {history.map((event, i) => {
          // Sửa đơn, chuyển giao không đổi trạng thái: chấm xám
          const keepsStatus = event.action === 'edit' || event.action === 'transfer';
          return (
            <li key={i} className={styles.event}>
              <span className={`${styles.dot} ${keepsStatus ? '' : styles[event.status]}`} aria-hidden="true" />
              <div className={styles.text}>
                <span className={styles.what}>{eventTitle(event)}</span>
                <span className={styles.who}>
                  {event.actor.name} · <time dateTime={event.at}>{formatDateTime(event.at)}</time>
                </span>
                {event.note && <span className={styles.note}>{event.note}</span>}
              </div>
            </li>
          );
        })}
      </ol>
    </PanelSection>
  );
}
