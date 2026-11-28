import { describe, expect, it } from 'vitest';
import { plainTextToRichText } from '../aux-schema/rich-text';
import { EMAIL_EVENT_KINDS } from '../aux-schema/email--events';
import { EmailSettingsSchema } from '../api-contract/email';
import { EMAIL_SETTINGS_SEED } from '../seed/email-settings';
import { withAllEmailEvents } from './email--settings';

describe('withAllEmailEvents', () => {
  it('cấu hình cũ bốn lúc gửi (ghi status): giữ bốn thư cũ, thêm ba thư cho cán bộ theo mặc định', () => {
    // Arrange: bản lưu cũ, thư Đã nộp đã sửa, thư Đã duyệt đang tắt
    const oldSettings = {
      sender: { name: 'PĐT', signature: 'Kí' },
      events: (['nop', 'bs', 'tc', 'duyet'] as const).map((status) => ({
        status,
        enabled: status !== 'duyet',
        subject: `Tiêu đề ${status}`,
        body: plainTextToRichText(`Nội dung ${status}`),
      })),
    };

    // Act
    const settings = withAllEmailEvents(oldSettings, EMAIL_SETTINGS_SEED);

    // Assert
    expect(EmailSettingsSchema.safeParse(settings).success).toBe(true);
    expect(settings.sender).toEqual(oldSettings.sender);
    expect(settings.events.map((event) => event.kind)).toEqual([...EMAIL_EVENT_KINDS]);
    expect(settings.events[0]).toEqual({ kind: 'nop', enabled: true, subject: 'Tiêu đề nop', body: plainTextToRichText('Nội dung nop') });
    expect(settings.events[3]!.enabled).toBe(false);
    expect(settings.events.slice(4)).toEqual(EMAIL_SETTINGS_SEED.events.slice(4));
    expect(settings.events[0]).not.toHaveProperty('status');
  });

  it('cấu hình mới đủ bảy lúc gửi: giữ nguyên', () => {
    expect(withAllEmailEvents(EMAIL_SETTINGS_SEED, EMAIL_SETTINGS_SEED)).toEqual(EMAIL_SETTINGS_SEED);
  });

  it('không sửa cấu hình mặc định khi lấy thư từ đó', () => {
    const settings = withAllEmailEvents({ sender: EMAIL_SETTINGS_SEED.sender, events: [] }, EMAIL_SETTINGS_SEED);
    settings.events[0]!.subject = 'đã sửa';
    expect(EMAIL_SETTINGS_SEED.events[0]!.subject).not.toBe('đã sửa');
  });
});
