/* Trang Cấu hình email (#/cau-hinh-email, vai trò có quyền manageEmail: Người xử lí đơn, Admin).
   Cấu hình phía GỬI: người gửi, và bốn lúc gửi email báo cho người nộp đơn (Đã nộp · Cần bổ sung · Từ chối · Đã duyệt),
   mỗi lúc bật / tắt riêng, soạn tiêu đề + nội dung có mã {...}, xem trước bằng dữ liệu mẫu, gửi thư thử.
   Người nhận không cấu hình: thư luôn gửi tới email trên trang Thông tin cá nhân của người nộp đơn.
   Mọi thay đổi sửa trên bản nháp trong trình duyệt; bấm Lưu mới gửi lên máy chủ, Bỏ thay đổi trả về bản đã lưu. */
import { useState, type KeyboardEvent } from 'react';
import {
  EMAIL_EVENT_STATUSES,
  EMAIL_MESSAGES,
  EmailSettingsSchema,
  FORM_STATUS_LABEL,
  type EmailEventSetting,
  type EmailEventStatus,
  type EmailSender,
  type EmailSettings,
  type StaffRef,
} from '@ulaw/shared';
import { useEmailSettings, useSaveEmailSettings } from '../../api/email';
import { Button } from '../../components/Button';
import { Field } from '../../components/Field';
import { LoadError, loadErrorMessage } from '../../components/LoadError';
import { RefreshButton } from '../../components/RefreshButton';
import { useToast } from '../../components/Toast';
import { formatDateTime } from '../../lib/format';
import { EmailEventEditor } from './EmailEventEditor';
import profileStyles from '../profile/ProfilePage.module.css';
import styles from './EmailSettingsPage.module.css';

/** Câu báo lỗi theo ô, khóa là đường dẫn của ô trong cấu hình, vd 'sender.name', 'events.1.subject'. */
export type FieldErrors = Record<string, string>;


/**
 * Trang Cấu hình email: tải cấu hình đang dùng rồi mở phần sửa.
 * @returns  giao diện trang; đang tải thì câu chờ; lỗi thì câu báo lỗi kèm nút ↻
 */
export function EmailSettingsPage() {
  const settingsQuery = useEmailSettings();
  const loadError = loadErrorMessage(settingsQuery);

  // Chưa có dữ liệu: câu chờ, hoặc câu báo lỗi kèm nút tải lại
  if (settingsQuery.isPending) {
    return (
      <div className={profileStyles.page}>
        <p className={profileStyles.muted}>Đang tải cấu hình email…</p>
      </div>
    );
  }
  if (loadError || !settingsQuery.data) {
    return (
      <div className={profileStyles.page}>
        <section className={`${profileStyles.card} ${profileStyles.errorCard}`}>
          <LoadError message={loadError ?? 'Không tải được cấu hình email.'} />
          <RefreshButton query={settingsQuery} label="Cấu hình email" />
        </section>
      </div>
    );
  }

  return (
    <EmailSettingsEditor
      saved={settingsQuery.data.settings}
      updatedAt={settingsQuery.data.updatedAt}
      updatedBy={settingsQuery.data.updatedBy}
      senderAddress={settingsQuery.data.senderAddress}
      mailServerConnected={settingsQuery.data.mailServerConnected}
      settingsQuery={settingsQuery}
    />
  );
}

/**
 * Đổi các lỗi của zod thành câu báo theo ô.
 * @param settings  bản nháp cấu hình
 * @returns         câu báo lỗi theo đường dẫn ô; mỗi ô lấy lỗi đầu tiên; không lỗi thì {}
 */
function validateSettings(settings: EmailSettings): FieldErrors {
  const parsed = EmailSettingsSchema.safeParse(settings);
  const errors: FieldErrors = {};
  for (const issue of parsed.error?.issues ?? []) {
    const path = issue.path.join('.');
    errors[path] ??= issue.message;
  }
  return errors;
}

/**
 * Phần sửa cấu hình: đầu trang (tiêu đề, Chưa lưu), thẻ Người gửi, thẻ Nội dung email, cuối trang (Bỏ thay đổi, Lưu).
 * @param saved                cấu hình đã lưu ở máy chủ
 * @param updatedAt            lần lưu gần nhất, giờ Việt Nam 'YYYY-MM-DDTHH:mm'
 * @param updatedBy            cán bộ lưu lần gần nhất (họ tên, email)
 * @param senderAddress        địa chỉ gửi, máy chủ đọc từ cấu hình SMTP; chỉ hiện, không sửa được
 * @param mailServerConnected  máy chủ thư đã kết nối được chưa (máy chủ kiểm tra lúc tải cấu hình)
 * @param settingsQuery        kết quả useEmailSettings, cho nút ↻ kiểm tra lại máy chủ thư (bản nháp đang sửa vẫn giữ)
 * @returns                    giao diện trang
 */
function EmailSettingsEditor({
  saved,
  updatedAt,
  updatedBy,
  senderAddress,
  mailServerConnected,
  settingsQuery,
}: {
  saved: EmailSettings;
  updatedAt: string;
  updatedBy: StaffRef;
  senderAddress: string;
  mailServerConnected: boolean;
  settingsQuery: ReturnType<typeof useEmailSettings>;
}) {
  const toast = useToast();
  const saveSettings = useSaveEmailSettings();
  const [draft, setDraft] = useState<EmailSettings>(saved);
  const [selectedStatus, setSelectedStatus] = useState<EmailEventStatus>(EMAIL_EVENT_STATUSES[0]);
  // Chỉ báo lỗi từng ô sau lần bấm Lưu đầu tiên; từ đó lỗi cập nhật ngay khi sửa
  const [showErrors, setShowErrors] = useState(false);

  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const fieldErrors = showErrors ? validateSettings(draft) : {};
  const selectedIndex = EMAIL_EVENT_STATUSES.indexOf(selectedStatus);

  // Sửa một ô của Người gửi / của lúc gửi đang chọn
  const changeSender = (key: keyof EmailSender, text: string) => setDraft((current) => ({ ...current, sender: { ...current.sender, [key]: text } }));
  const changeEvent = (changes: Partial<EmailEventSetting>) =>
    setDraft((current) => ({
      ...current,
      events: current.events.map((event, index) => (index === selectedIndex ? { ...event, ...changes } : event)),
    }));

  // Lưu: còn lỗi thì báo dưới từng ô (và mở tab lúc gửi đầu tiên có lỗi nếu Người gửi không lỗi); lỗi máy chủ hiện toast
  const save = async () => {
    const errors = validateSettings(draft);
    if (Object.keys(errors).length > 0) {
      setShowErrors(true);
      const firstEventIndex = EMAIL_EVENT_STATUSES.findIndex((_status, index) => Object.keys(errors).some((path) => path.startsWith(`events.${index}.`)));
      const senderHasError = Object.keys(errors).some((path) => path.startsWith('sender.'));
      if (!senderHasError && firstEventIndex >= 0) setSelectedStatus(EMAIL_EVENT_STATUSES[firstEventIndex]!);
      return;
    }
    try {
      const response = await saveSettings.mutateAsync(draft);
      setDraft(response.settings);
      setShowErrors(false);
      toast(EMAIL_MESSAGES.saved, 'success');
    } catch (error) {
      toast(error instanceof Error ? error.message : EMAIL_MESSAGES[422], 'error');
    }
  };

  // Bỏ thay đổi: trả về bản đã lưu, bỏ mọi câu báo lỗi
  const discardChanges = () => {
    setDraft(saved);
    setShowErrors(false);
  };

  // Phím ← → trên hàng tab: chuyển sang lúc gửi bên cạnh (vòng lại đầu / cuối)
  const moveTab = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    const step = event.key === 'ArrowRight' ? 1 : EMAIL_EVENT_STATUSES.length - 1;
    const nextStatus = EMAIL_EVENT_STATUSES[(selectedIndex + step) % EMAIL_EVENT_STATUSES.length]!;
    setSelectedStatus(nextStatus);
    document.getElementById(`email-tab-${nextStatus}`)?.focus();
  };

  return (
    <div className={profileStyles.page}>
      {/* Đầu trang: tiêu đề và lần lưu gần nhất bên trái; nhãn "Chưa lưu" bên phải khi có thay đổi */}
      <div className={styles.head}>
        <div className={styles.titleBlock}>
          <h1 className={styles.title}>Cấu hình email</h1>
          <p className={styles.lastUpdate}>
            Cập nhật lúc {formatDateTime(updatedAt)} bởi {updatedBy.name} ({updatedBy.email})
          </p>
        </div>
        {dirty && <span className={styles.dirty}>Chưa lưu</span>}
      </div>

      <section className={`${profileStyles.card} ${styles.senderCard}`} aria-labelledby="email-sender-title">
        <div className={styles.cardHead}>
          <h2 id="email-sender-title">Người gửi</h2>
          {/* nhãn kết nối (kết quả kiểm tra lúc tải trang) và nút ↻ kiểm tra lại */}
          <div className={styles.connection} aria-live="polite">
            {settingsQuery.isFetching ? (
              <span className={styles.checking}>
                <i aria-hidden="true" />
                Đang kiểm tra máy chủ thư…
              </span>
            ) : (
              <span className={mailServerConnected ? styles.connected : styles.disconnected}>
                <i aria-hidden="true" />
                {mailServerConnected ? 'Đã kết nối máy chủ thư' : 'Chưa kết nối máy chủ thư'}
              </span>
            )}
            <RefreshButton query={settingsQuery} label="trạng thái máy chủ thư" size="small" />
          </div>
        </div>
        {/* Tên + Địa chỉ gửi một hàng; Chữ kí một hàng riêng. Địa chỉ gửi đi cùng mật khẩu ứng dụng SMTP ở máy chủ nên chỉ đọc */}
        <div className={styles.senderGrid}>
          <div>
            <Field label="Tên người gửi" required hint="Hiện ở dòng “Từ” trong hộp thư người nhận" error={fieldErrors['sender.name']}>
              <input
                type="text"
                autoComplete="off"
                value={draft.sender.name}
                aria-invalid={!!fieldErrors['sender.name']}
                onChange={(event) => changeSender('name', event.target.value)}
              />
            </Field>
          </div>
          <div>
            <Field label="Địa chỉ gửi" hint="Lấy từ cấu hình máy chủ thư (SMTP), không sửa ở đây">
              <input type="email" value={senderAddress} readOnly />
            </Field>
          </div>
          <div className={styles.wide}>
            <Field label="Chữ kí cuối thư" hint="Dùng trong thư bằng mã {chu_ki}" error={fieldErrors['sender.signature']}>
              <input
                type="text"
                autoComplete="off"
                value={draft.sender.signature}
                aria-invalid={!!fieldErrors['sender.signature']}
                onChange={(event) => changeSender('signature', event.target.value)}
              />
            </Field>
          </div>
        </div>
      </section>

      <section className={`${profileStyles.card} ${styles.contentCard}`} aria-labelledby="email-content-title">
        <h2 id="email-content-title" className={styles.contentTitle}>
          Nội dung email
        </h2>
        {/* bốn lúc gửi email: tab ngang; chấm màu theo trạng thái, lúc đang tắt ghi "Tắt", lúc có ô lỗi thì chấm đỏ */}
        <div className={styles.tabs} role="tablist" aria-label="Lúc gửi email" onKeyDown={moveTab}>
          {draft.events.map((event, index) => {
            const hasError = Object.keys(fieldErrors).some((path) => path.startsWith(`events.${index}.`));
            return (
              <button
                key={event.status}
                id={`email-tab-${event.status}`}
                type="button"
                role="tab"
                aria-selected={event.status === selectedStatus}
                aria-controls="email-event-panel"
                tabIndex={event.status === selectedStatus ? 0 : -1}
                className={`${styles.tab} ${event.enabled ? '' : styles.tabOff}`}
                onClick={() => setSelectedStatus(event.status)}
              >
                <span className={`${styles.dot} ${hasError ? styles.dotError : ''}`} data-status={event.status} aria-hidden="true" />
                {FORM_STATUS_LABEL[event.status]}
                {!event.enabled && <span className={styles.offTag}>Tắt</span>}
                {hasError && <span className={styles.visuallyHidden}> (có ô chưa đúng)</span>}
              </button>
            );
          })}
        </div>
        <div id="email-event-panel" role="tabpanel" aria-labelledby={`email-tab-${selectedStatus}`}>
          <EmailEventEditor
            key={selectedStatus}
            event={draft.events[selectedIndex]!}
            eventIndex={selectedIndex}
            sender={draft.sender}
            senderAddress={senderAddress}
            fieldErrors={fieldErrors}
            onChange={changeEvent}
          />
        </div>
      </section>

      {/* Cuối trang: Bỏ thay đổi · Lưu, chỉ hiện khi có thay đổi */}
      {dirty && (
        <div className={styles.bottomActions}>
          <Button variant="ghost" onClick={discardChanges} disabled={saveSettings.isPending}>
            Bỏ thay đổi
          </Button>
          <Button variant="primary" onClick={save} disabled={saveSettings.isPending}>
            {saveSettings.isPending ? 'Đang lưu…' : 'Lưu'}
          </Button>
        </div>
      )}
    </div>
  );
}
