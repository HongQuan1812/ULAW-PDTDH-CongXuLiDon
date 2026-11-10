/* Hộp thoại Chuyển giao đơn cho cán bộ khác (như #tModal của bản mẫu).
   Ô "Chuyển cho" là combobox: bấm vào để mở danh sách cán bộ, gõ để lọc theo tên / email, ↑ ↓ Enter để chọn. */
import { useEffect, useId, useState } from 'react';
import { FORM_MESSAGES, type FormDetail, type StaffRef } from '@ulaw/shared';
import { useTransferForm, useTransferTargets } from '../../api/forms';
import { Button } from '../../components/Button';
import { Modal } from '../../components/Modal';
import { useToast } from '../../components/Toast';
import { normalizeText } from '../../lib/search';
import styles from './TransferDialog.module.css';

/** Câu báo khi chuyển giao lỗi mà máy chủ không gửi kèm câu báo (vd mất mạng). */
const TRANSFER_FAILED_TEXT = 'Chưa chuyển giao được. Kiểm tra kết nối mạng rồi thử lại.';

/**
 * Lọc danh sách cán bộ theo từ khóa, không phân biệt hoa thường và dấu.
 * @param staffList  danh sách cán bộ
 * @param keyword    từ khóa gõ trong ô; rỗng = lấy hết
 * @returns          cán bộ có tên hoặc email chứa từ khóa
 */
function filterStaff(staffList: readonly StaffRef[], keyword: string): StaffRef[] {
  const normalizedKeyword = normalizeText(keyword.trim());
  if (!normalizedKeyword) return [...staffList];
  return staffList.filter(
    (staff) => normalizeText(staff.name).includes(normalizedKeyword) || normalizeText(staff.email).includes(normalizedKeyword),
  );
}

/**
 * Hộp thoại chọn cán bộ nhận đơn. Chuyển giao xong thì đóng, trang vẽ lại theo lá đơn mới và toast báo kết quả.
 * @param form     lá đơn cần chuyển giao (đã có người xử lí)
 * @param open     đang mở hay không
 * @param onClose  gọi khi đóng hộp thoại
 * @returns        hộp thoại
 */
export function TransferDialog({ form, open, onClose }: { form: FormDetail; open: boolean; onClose: () => void }) {
  const toast = useToast();
  const listId = useId();
  const targets = useTransferTargets(form.code, open);
  const transferForm = useTransferForm(form.code);
  // Chữ trong ô tìm, cán bộ đã chọn (null = chưa chọn), danh sách đang mở, dòng đang tô sáng
  const [searchText, setSearchText] = useState('');
  const [pickedStaff, setPickedStaff] = useState<StaffRef | null>(null);
  const [listOpen, setListOpen] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const matches = filterStaff(targets.data ?? [], searchText);
  const activeStaff = matches[Math.min(activeIndex, matches.length - 1)];

  // Mỗi lần mở: xóa lựa chọn cũ, mở sẵn danh sách
  useEffect(() => {
    if (!open) return;
    setSearchText('');
    setPickedStaff(null);
    setListOpen(true);
    setActiveIndex(0);
  }, [open]);

  /** Chọn một cán bộ: điền tên vào ô, đóng danh sách. */
  const pickStaff = (staff: StaffRef) => {
    setPickedStaff(staff);
    setSearchText(staff.name);
    setListOpen(false);
  };

  /** Gõ chữ: bỏ lựa chọn cũ, mở danh sách đã lọc. */
  const changeSearch = (text: string) => {
    setSearchText(text);
    setPickedStaff(null);
    setListOpen(true);
    setActiveIndex(0);
  };

  /** ↑ ↓ đổi dòng tô sáng, Enter chọn dòng đó, Esc lần đầu chỉ đóng danh sách (không đóng hộp thoại). */
  const handleKey = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!listOpen) return setListOpen(true);
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActiveIndex((current) => (current + step + matches.length) % Math.max(1, matches.length));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (listOpen && activeStaff) pickStaff(activeStaff);
    } else if (event.key === 'Escape' && listOpen) {
      event.stopPropagation();
      event.nativeEvent.stopImmediatePropagation();
      setListOpen(false);
    }
  };

  /** Gửi chuyển giao; xong thì đóng và báo kết quả, lỗi thì báo câu máy chủ gửi (hộp thoại giữ nguyên để thử lại). */
  const confirmTransfer = () => {
    if (!pickedStaff) return;
    transferForm.mutate(
      { toStaffId: pickedStaff.id },
      {
        onSuccess: (transferredForm) => {
          onClose();
          toast(FORM_MESSAGES.transferred(transferredForm.code, pickedStaff.name), 'success');
        },
        onError: (error) => toast(error.message || TRANSFER_FAILED_TEXT, 'error'),
      },
    );
  };

  /** Đóng hộp thoại (đang gửi thì bỏ qua để không mất kết quả). */
  const closeDialog = () => {
    if (!transferForm.isPending) onClose();
  };

  const emptyText = targets.isPending
    ? 'Đang tải danh sách cán bộ…'
    : targets.isError
      ? 'Chưa tải được danh sách cán bộ.'
      : (targets.data?.length ?? 0) === 0
        ? 'Không có cán bộ khác để chuyển giao.'
        : 'Không tìm thấy cán bộ phù hợp.';

  return (
    <Modal open={open} onClose={closeDialog} title={`Chuyển giao đơn ${form.code}`}>
      <p className={styles.subtitle}>
        Người xử lí hiện tại: <b>{form.handler?.name}</b>
      </p>
      <div className={styles.comboField}>
        <label htmlFor={`${listId}-input`}>Chuyển cho</label>
        <div className={styles.combo}>
          <input
            id={`${listId}-input`}
            role="combobox"
            aria-expanded={listOpen}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={listOpen && activeStaff ? `${listId}-${activeStaff.id}` : undefined}
            autoComplete="off"
            placeholder="Chọn hoặc tìm theo tên, email"
            value={searchText}
            onChange={(event) => changeSearch(event.target.value)}
            onClick={() => setListOpen(true)}
            onKeyDown={handleKey}
            disabled={transferForm.isPending}
          />
          <svg className={styles.caret} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m6 9 6 6 6-6" />
          </svg>
          {listOpen && (
            <ul
              id={listId}
              role="listbox"
              className={styles.list}
              // giữ con trỏ trong ô tìm để cú bấm chọn không làm ô mất focus
              onMouseDown={(event) => event.preventDefault()}
            >
              {matches.length === 0 && <li className={styles.none}>{emptyText}</li>}
              {matches.map((staff) => (
                <li
                  key={staff.id}
                  id={`${listId}-${staff.id}`}
                  role="option"
                  aria-selected={pickedStaff?.id === staff.id}
                  className={staff.id === activeStaff?.id ? styles.active : undefined}
                  onClick={() => pickStaff(staff)}
                >
                  <span className={styles.staffName}>{staff.name}</span>
                  <span className={styles.staffEmail}>{staff.email}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <div className={styles.buttons}>
        <Button variant="ghost" onClick={closeDialog} disabled={transferForm.isPending}>
          Hủy
        </Button>
        <Button variant="primary" onClick={confirmTransfer} disabled={!pickedStaff || transferForm.isPending}>
          {transferForm.isPending ? 'Đang chuyển…' : 'Chuyển giao'}
        </Button>
      </div>
    </Modal>
  );
}
