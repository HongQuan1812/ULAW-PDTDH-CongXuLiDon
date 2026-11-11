/* Khung "Phiên bản" của trình soạn loại đơn, cùng kiểu khung "Thông tin đơn" ở trang đơn (FormInfoPanel):
   màn hình rộng nằm bên phải nội dung soạn; màn hình hẹp trượt ra từ bên phải.
   Mỗi phiên bản một mục: tên loại đơn, mã đơn, trạng thái phiên bản, mô tả ngắn (dài thì chỉ hiện 2 dòng, bấm "Xem thêm" để hiện hết).
   Bấm mục để xem / soạn phiên bản đó. */
import { useLayoutEffect, useRef, useState } from 'react';
import type { FormTypeStatus } from '@ulaw/shared';
import { FormTypeStatusPill } from '../../components/StatusPill';
import { FormInfoPanel, type FormInfoPanelState } from '../form/FormInfoPanel';
import styles from './FormTypeVersionPanel.module.css';

/** Tiêu đề khung và chữ trên nút hiện khung. */
export const VERSION_PANEL_TITLE = 'Phiên bản';

/** Khóa localStorage nhớ việc đã ẩn khung Phiên bản ở màn hình rộng. */
export const VERSION_PANEL_STORAGE_KEY = 'formTypeVersionPanel.hiddenOnWideScreen';

/** Một phiên bản để chọn trong khung. */
export interface VersionChoice {
  version: number;
  name: string;
  prefix: string;
  status: FormTypeStatus;
  /** Mô tả ngắn; không có thì null hoặc chuỗi trống */
  description: string | null;
  /** true: có thay đổi chưa lưu (hoặc là phiên bản mới chưa lưu) */
  unsaved: boolean;
}

interface FormTypeVersionPanelProps {
  /** Trạng thái ẩn / hiện khung (useFormInfoPanel) */
  panel: FormInfoPanelState;
  /** Các phiên bản, mới trước */
  choices: readonly VersionChoice[];
  /** Phiên bản đang xem */
  selectedVersion: number;
  /** Gọi khi bấm một phiên bản */
  onSelect: (version: number) => void;
}

/**
 * Khung chọn phiên bản. Màn hình hẹp: chọn xong thì khung tự đóng.
 * @param props  xem FormTypeVersionPanelProps
 * @returns      khung "Phiên bản" với danh sách phiên bản
 */
export function FormTypeVersionPanel({ panel, choices, selectedVersion, onSelect }: FormTypeVersionPanelProps) {
  /**
   * Chọn một phiên bản; màn hình hẹp thì đóng khung trượt để thấy nội dung.
   * @param version  số phiên bản
   */
  const selectVersion = (version: number) => {
    onSelect(version);
    if (panel.isNarrow) panel.closePanel();
  };

  return (
    <FormInfoPanel panel={panel} title={VERSION_PANEL_TITLE}>
      <ul className={styles.list}>
        {choices.map((choice) => (
          <VersionChoiceItem
            key={choice.version}
            choice={choice}
            isSelected={choice.version === selectedVersion}
            onSelect={() => selectVersion(choice.version)}
          />
        ))}
      </ul>
    </FormInfoPanel>
  );
}

/**
 * Một mục phiên bản: nút chọn (số phiên bản, tên, mã đơn, trạng thái, mô tả ngắn) và nút "Xem thêm" / "Thu gọn" cho mô tả dài.
 * Nút "Xem thêm" nằm ngoài nút chọn (không lồng nút trong nút), chỉ hiện khi mô tả bị cắt.
 * @param choice      phiên bản
 * @param isSelected  true: phiên bản đang xem
 * @param onSelect    gọi khi bấm chọn
 * @returns           thẻ <li>
 */
function VersionChoiceItem({ choice, isSelected, onSelect }: { choice: VersionChoice; isSelected: boolean; onSelect: () => void }) {
  const description = choice.description?.trim() ?? '';
  const descriptionRef = useRef<HTMLElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);

  // Đo xem mô tả có dài hơn 2 dòng không (đo lúc đang thu gọn); đổi mô tả hoặc đổi cỡ khung thì đo lại
  useLayoutEffect(() => {
    const element = descriptionRef.current;
    if (!element || expanded) return;
    const measure = () => setOverflowing(element.scrollHeight > element.clientHeight + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [description, expanded]);

  return (
    <li className={`${styles.item} ${isSelected ? styles.selected : ''}`}>
      <button type="button" className={styles.choice} aria-current={isSelected || undefined} onClick={onSelect}>
        {/* Số phiên bản, ghi chú đang xem */}
        <span className={styles.choiceHead}>
          <span className={styles.versionNumber}>Phiên bản {choice.version}</span>
          {isSelected && <span className={styles.viewing}>Đang xem</span>}
        </span>

        {/* Tên loại đơn, mã đơn, trạng thái, mô tả ngắn */}
        <dl className={styles.meta}>
          <div>
            <dt>Tên loại đơn</dt>
            <dd>{choice.name.trim() || <span className={styles.empty}>(chưa đặt tên)</span>}</dd>
          </div>
          <div>
            <dt>Mã đơn</dt>
            <dd>{choice.prefix || <span className={styles.empty}>(chưa có)</span>}</dd>
          </div>
          <div>
            <dt>Trạng thái</dt>
            <dd className={styles.statusValue}>
              <FormTypeStatusPill status={choice.status} />
              {choice.unsaved && <span className={styles.unsaved}>Chưa lưu</span>}
            </dd>
          </div>
          <div>
            <dt>Mô tả ngắn</dt>
            <dd ref={descriptionRef} className={`${styles.description} ${expanded ? '' : styles.clamped}`}>
              {description || <span className={styles.empty}>(không có)</span>}
            </dd>
          </div>
        </dl>
      </button>

      {/* Mô tả dài: mở rộng / thu gọn */}
      {(overflowing || expanded) && (
        <button type="button" className={styles.more} aria-expanded={expanded} onClick={() => setExpanded((current) => !current)}>
          {expanded ? 'Thu gọn' : 'Xem thêm'}
        </button>
      )}
    </li>
  );
}
