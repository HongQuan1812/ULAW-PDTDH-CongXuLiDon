/* Thẻ "Thông tin loại đơn" của trình soạn (như .fe-info của artifact/js/forms-page.js):
   tên loại đơn, mã đơn, mô tả ngắn, trạng thái Nháp / Đang mở / Đã đóng kèm câu giải thích. */
import { FORM_TYPE_STATUSES, FORM_TYPE_STATUS_LABEL, type FormTypeStatus } from '@ulaw/shared';
import { Field } from '../../components/Field';
import { cleanPrefix, type FormTypeDraft } from './formTypeDraft';
import styles from './FormTypeEditor.module.css';

/** Câu giải thích dưới các nút trạng thái. */
const STATUS_HINT: Record<FormTypeStatus, string> = {
  draft: 'Người nộp đơn chưa thấy loại đơn này; chỉ người xử lí đơn và Admin thấy để soạn.',
  open: 'Người nộp đơn chọn được loại đơn này khi bấm “Nộp đơn mới”.',
  closed: 'Không nhận đơn mới; các đơn đã nộp vẫn xử lí bình thường.',
};

interface FormTypeInfoCardProps {
  draft: FormTypeDraft;
  /** Gọi với các thông tin đã đổi */
  onChange: (changes: Partial<FormTypeDraft>) => void;
}

/**
 * Thẻ thông tin chung của loại đơn.
 * @param props  xem FormTypeInfoCardProps
 * @returns      thẻ <section>
 */
export function FormTypeInfoCard({ draft, onChange }: FormTypeInfoCardProps) {
  return (
    <section className={styles.card} aria-labelledby="form-type-info-title">
      <div className={styles.cardHead}>
        <h2 id="form-type-info-title">Thông tin loại đơn</h2>
      </div>

      <div className={styles.grid2}>
        <Field label="Tên loại đơn" hint="Dùng ở mọi nơi: tiêu đề trang đơn, danh sách chọn loại đơn, bảng và thống kê">
          <input value={draft.name} placeholder="VD: Xin bảo lưu kết quả học tập" onChange={(event) => onChange({ name: event.target.value })} />
        </Field>
        <Field label="Mã đơn" hint="2–5 chữ in hoa, đứng đầu mã mỗi đơn (vd XMM-2026-00001)">
          <input value={draft.prefix} placeholder="VD: BL" onChange={(event) => onChange({ prefix: cleanPrefix(event.target.value) })} />
        </Field>
        <div className={styles.wide}>
          <Field label="Mô tả ngắn" hint="Hiện khi người nộp đơn chọn loại đơn">
            <input value={draft.description} onChange={(event) => onChange({ description: event.target.value })} />
          </Field>
        </div>
      </div>

      <fieldset className={styles.segment}>
        <legend>Trạng thái</legend>
        {FORM_TYPE_STATUSES.map((status) => (
          <label key={status}>
            <input type="radio" name="form-type-status" value={status} checked={draft.status === status} onChange={() => onChange({ status })} />
            <span>{FORM_TYPE_STATUS_LABEL[status]}</span>
          </label>
        ))}
        <span className={`${styles.hint} ${styles.segmentHint}`}>{STATUS_HINT[draft.status]}</span>
      </fieldset>
    </section>
  );
}
