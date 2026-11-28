import { describe, expect, it } from 'vitest';
import { EMAIL_EVENT_KINDS } from '../aux-schema/email--events';
import { EMPTY_RICH_TEXT_DOC, plainTextToRichText } from '../aux-schema/rich-text';
import { EmailSettingsSchema, type EmailSettings } from './email';

const settings: EmailSettings = {
  sender: { name: 'Phòng Đào tạo', signature: '' },
  events: EMAIL_EVENT_KINDS.map((kind) => ({ kind, enabled: true, subject: 'Tiêu đề', body: plainTextToRichText('Nội dung') })),
};

describe('EmailSettingsSchema', () => {
  it('nhận cấu hình đủ bảy lúc gửi theo đúng thứ tự', () => {
    expect(EmailSettingsSchema.safeParse(settings).success).toBe(true);
  });

  it('từ chối khi thiếu, thừa hoặc sai thứ tự lúc gửi', () => {
    expect(EmailSettingsSchema.safeParse({ ...settings, events: settings.events.slice(1) }).success).toBe(false);
    expect(EmailSettingsSchema.safeParse({ ...settings, events: [...settings.events].reverse() }).success).toBe(false);
    expect(EmailSettingsSchema.safeParse({ ...settings, events: settings.events.slice(0, 4) }).success).toBe(false);
  });

  it('báo lỗi đúng ô: tên người gửi trống, tiêu đề và nội dung trống', () => {
    const parsed = EmailSettingsSchema.safeParse({
      sender: { name: ' ', signature: '' },
      events: settings.events.map((event, index) => (index === 1 ? { ...event, subject: '', body: EMPTY_RICH_TEXT_DOC } : event)),
    });
    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues.map((issue) => issue.path.join('.'))).toEqual([
      'sender.name',
      'events.1.subject',
      'events.1.body',
    ]);
  });
});
