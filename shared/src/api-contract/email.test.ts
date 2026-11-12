import { describe, expect, it } from 'vitest';
import { EMPTY_RICH_TEXT_DOC, plainTextToRichText } from '../aux-schema/rich-text';
import { EmailSettingsSchema, type EmailSettings } from './email';

const settings: EmailSettings = {
  sender: { name: 'Phòng Đào tạo', address: 'daotao@hcmulaw.edu.vn', signature: '' },
  events: (['nop', 'bs', 'tc', 'duyet'] as const).map((status) => ({ status, enabled: true, subject: 'Tiêu đề', body: plainTextToRichText('Nội dung') })),
};

describe('EmailSettingsSchema', () => {
  it('nhận cấu hình đủ bốn lúc gửi theo đúng thứ tự', () => {
    expect(EmailSettingsSchema.safeParse(settings).success).toBe(true);
  });

  it('từ chối khi thiếu, thừa hoặc sai thứ tự lúc gửi', () => {
    expect(EmailSettingsSchema.safeParse({ ...settings, events: settings.events.slice(1) }).success).toBe(false);
    expect(EmailSettingsSchema.safeParse({ ...settings, events: [...settings.events].reverse() }).success).toBe(false);
  });

  it('báo lỗi đúng ô: tên người gửi trống, địa chỉ gửi sai, tiêu đề và nội dung trống', () => {
    const parsed = EmailSettingsSchema.safeParse({
      sender: { name: ' ', address: 'daotao', signature: '' },
      events: settings.events.map((event, index) => (index === 1 ? { ...event, subject: '', body: EMPTY_RICH_TEXT_DOC } : event)),
    });
    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues.map((issue) => issue.path.join('.'))).toEqual([
      'sender.name',
      'sender.address',
      'events.1.subject',
      'events.1.body',
    ]);
  });
});
