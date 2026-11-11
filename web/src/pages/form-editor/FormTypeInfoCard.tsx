/* Thẻ "Thông tin loại đơn" của trình soạn (như .fe-info của artifact/js/forms-page.js):
   tên loại đơn, mã đơn, mô tả ngắn của phiên bản đang xem, và trạng thái của phiên bản đó kèm câu giải thích.
   Phiên bản Nháp chọn Nháp / Đang mở; phiên bản đã khóa chọn Đang mở / Đã đóng. */
import { FORM_TYPE_ISSUE_TARGET, FORM_TYPE_STATUS_LABEL, type FormTypeStatus } from '@ulaw/shared';
import { Field } from '../../components/Field';
import { useDraftIssues } from './draftIssues';
import { cleanPrefix, type FormTypeDraft } from './formTypeDraft';
import styles from './FormTypeEditor.module.css';

interface FormTypeInfoCardProps {
  draft: FormTypeDraft;
  /** Đã có phiên bản từng được mở: khóa ô mã đơn */
  prefixLocked: boolean;
  /** Không sửa được tên, mô tả (phiên bản đã khóa khi đang có phiên bản khác đang soạn) */
  contentLocked: boolean;
  /** Trạng thái đang chọn của phiên bản */
  status: FormTypeStatus;
  /** Các trạng thái chọn được */
  statusChoices: readonly FormTypeStatus[];
  /** Câu giải thích dưới các nút trạng thái */
  statusHint: string;
  /** Gọi với tên, mã đơn, mô tả đã đổi */
  onChange: (changes: Partial<Pick<FormTypeDraft, 'name' | 'prefix' | 'description'>>) => void;
  /** Gọi khi chọn trạng thái khác */
  onStatusChange: (status: FormTypeStatus) => void;
}

/**
 * Thẻ thông tin chung của phiên bản đang xem.
 * @param props  xem FormTypeInfoCardProps
 * @returns      thẻ <section>
 */
export function FormTypeInfoCard({ draft, prefixLocked, contentLocked, status, statusChoices, statusHint, onChange, onStatusChange }: FormTypeInfoCardProps) {
  const invalidTargets = useDraftIssues();
  return (
    <section className={styles.card} aria-labelledby="form-type-info-title">
      <div className={styles.cardHead}>
        <h2 id="form-type-info-title">Thông tin loại đơn</h2>
      </div>

      {/* Tên, mã đơn, mô tả */}
      <div className={styles.grid2}>
        <Field label="Tên loại đơn" hint="Dùng ở mọi nơi: tiêu đề trang đơn, danh sách chọn loại đơn, bảng và thống kê">
          <input
            value={draft.name}
            disabled={contentLocked}
            aria-invalid={invalidTargets.has(FORM_TYPE_ISSUE_TARGET.name) || undefined}
            placeholder="VD: Xin bảo lưu kết quả học tập"
            onChange={(event) => onChange({ name: event.target.value })}
          />
        </Field>
        <Field
          label="Mã đơn"
          hint={
            prefixLocked
              ? 'Loại đơn đã phát hành nên không đổi được mã đơn'
              : '2–5 chữ in hoa, đứng đầu mã mỗi đơn (vd XMM-2026-001-00001, 001 là phiên bản)'
          }
        >
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
            <input value={draft.description} disabled={contentLocked} onChange={(event) => onChange({ description: event.target.value })} />
          </Field>
        </div>
      </div>

      {/* Trạng thái của phiên bản */}
      <fieldset className={styles.segment}>
        <legend>Trạng thái phiên bản</legend>
        {statusChoices.map((choice) => (
          <label key={choice}>
            <input type="radio" name="form-type-status" value={choice} checked={status === choice} onChange={() => onStatusChange(choice)} />
            <span>{FORM_TYPE_STATUS_LABEL[choice]}</span>
          </label>
        ))}
        <span className={`${styles.hint} ${styles.segmentHint}`}>{statusHint}</span>
      </fieldset>
    </section>
  );
}
