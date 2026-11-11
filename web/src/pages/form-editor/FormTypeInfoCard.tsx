/* Thẻ "Thông tin loại đơn" của trình soạn (như .fe-info của artifact/js/forms-page.js):
   tên loại đơn, mã đơn, mô tả ngắn, trạng thái Nháp / Đang mở / Đã đóng kèm câu giải thích. */
import { FORM_TYPE_ISSUE_TARGET, FORM_TYPE_STATUSES, FORM_TYPE_STATUS_LABEL, type FormTypeStatus } from '@ulaw/shared';
import { Field } from '../../components/Field';
import { useDraftIssues } from './draftIssues';
import { cleanPrefix, type FormTypeDraft } from './formTypeDraft';
import styles from './FormTypeEditor.module.css';

/** Câu giải thích dưới các nút trạng thái. */
const STATUS_HINT: Record<FormTypeStatus, string> = {
  draft: 'Người nộp đơn chưa thấy loại đơn này; chỉ người xử lí đơn và Admin thấy để soạn.',
  open: 'Người nộp đơn chọn được loại đơn này khi bấm “Nộp đơn mới”.',
  closed: 'Không nhận đơn mới; các đơn đã nộp vẫn xử lí bình thường.',
};

/** Ghi chú thêm khi nút Nháp bị khóa. */
const DRAFT_LOCKED_HINT = 'Loại đơn đã phát hành nên không về Nháp được; muốn ngừng nhận đơn thì chọn Đã đóng.';

interface FormTypeInfoCardProps {
  draft: FormTypeDraft;
  /** Loại đơn đã có đơn: khóa ô mã đơn */
  prefixLocked: boolean;
  /** Loại đơn đã phát hành (đang lưu ở Đang mở / Đã đóng): khóa nút Nháp */
  draftLocked: boolean;
  /** Gọi với các thông tin đã đổi */
  onChange: (changes: Partial<FormTypeDraft>) => void;
}

/**
 * Thẻ thông tin chung của loại đơn.
 * @param props  xem FormTypeInfoCardProps
 * @returns      thẻ <section>
 */
export function FormTypeInfoCard({ draft, prefixLocked, draftLocked, onChange }: FormTypeInfoCardProps) {
  const invalidTargets = useDraftIssues();
  return (
    <section className={styles.card} aria-labelledby="form-type-info-title">
      <div className={styles.cardHead}>
        <h2 id="form-type-info-title">Thông tin loại đơn</h2>
      </div>

      <div className={styles.grid2}>
        <Field label="Tên loại đơn" hint="Dùng ở mọi nơi: tiêu đề trang đơn, danh sách chọn loại đơn, bảng và thống kê">
          <input
            value={draft.name}
            aria-invalid={invalidTargets.has(FORM_TYPE_ISSUE_TARGET.name) || undefined}
            placeholder="VD: Xin bảo lưu kết quả học tập"
            onChange={(event) => onChange({ name: event.target.value })}
          />
        </Field>
        <Field label="Mã đơn" hint={prefixLocked ? 'Đã có đơn loại này nên không đổi được mã đơn' : '2–5 chữ in hoa, đứng đầu mã mỗi đơn (vd XMM-2026-00001)'}>
          <input
            value={draft.prefix}
            placeholder="VD: BL"
            readOnly={prefixLocked}
            aria-invalid={invalidTargets.has(FORM_TYPE_ISSUE_TARGET.prefix) || undefined}
            onChange={(event) => onChange({ prefix: cleanPrefix(event.target.value) })}
          />
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
            <input
              type="radio"
              name="form-type-status"
              value={status}
              checked={draft.status === status}
              disabled={status === 'draft' && draftLocked}
              onChange={() => onChange({ status })}
            />
            <span>{FORM_TYPE_STATUS_LABEL[status]}</span>
          </label>
        ))}
        <span className={`${styles.hint} ${styles.segmentHint}`}>
          {STATUS_HINT[draft.status]}
          {draftLocked && ` ${DRAFT_LOCKED_HINT}`}
        </span>
      </fieldset>
    </section>
  );
}
