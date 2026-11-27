/* Đọc cấu hình email đã lưu (JSON trong database / bộ nhớ của API giả) thành cấu hình đủ bảy lúc gửi.
   Cấu hình lưu trước khi có thư cho cán bộ chỉ có bốn lúc gửi, mỗi lúc ghi `status` thay cho `kind`:
   giữ nguyên bốn thư đó, thêm các lúc gửi còn thiếu theo cấu hình mặc định. */
import type { EmailEventSetting, EmailSettings } from '../api-contract/email';
import { EMAIL_EVENT_KINDS } from '../aux-schema/email--events';

/** Một lúc gửi như đã lưu: bản mới ghi `kind`, bản cũ ghi `status`. */
type StoredEmailEvent = Omit<EmailEventSetting, 'kind'> & { kind?: string; status?: string };

/**
 * Cấu hình email đủ bảy lúc gửi, theo thứ tự EMAIL_EVENT_KINDS.
 * @param stored    cấu hình đã lưu (có thể là bản cũ bốn lúc gửi)
 * @param defaults  cấu hình mặc định, lấy thư cho các lúc gửi còn thiếu
 * @returns         cấu hình mới (không sửa stored): người gửi như đã lưu, mỗi lúc gửi lấy bản đã lưu, chưa có thì lấy bản mặc định
 */
export function withAllEmailEvents(stored: unknown, defaults: EmailSettings): EmailSettings {
  const storedSettings = stored as { sender?: EmailSettings['sender']; events?: StoredEmailEvent[] } | null;
  const storedEvents = storedSettings?.events ?? [];

  // Mỗi lúc gửi: bản đã lưu (đổi `status` cũ thành `kind`), chưa có thì bản mặc định
  const events = EMAIL_EVENT_KINDS.map((kind): EmailEventSetting => {
    const storedEvent = storedEvents.find((event) => (event.kind ?? event.status) === kind);
    if (!storedEvent) return structuredClone(defaults.events.find((event) => event.kind === kind)!);
    return { kind, enabled: storedEvent.enabled, subject: storedEvent.subject, body: storedEvent.body };
  });

  return { sender: storedSettings?.sender ?? defaults.sender, events };
}
