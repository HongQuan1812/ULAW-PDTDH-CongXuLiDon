import { describe, expect, it } from 'vitest';
import { EMPTY_FORM_TYPE_TIME_SETTINGS, FORM_TYPE_TIME_ISSUE_TARGET, FORM_TYPE_TIME_MESSAGES, type FormTypeTimeSettings } from '@ulaw/shared';
import { formOfTimeSettings, sameTimeSettings, timeSettingsIssues, toSaveTimeSettingsRequest } from './timeSettingsForm';

/** Đã hẹn mở phiên bản 2 lúc 08:00 01/12, đóng lúc 17:00 05/12; giờ mở đã chạy. */
const saved: FormTypeTimeSettings = {
  maxProcessingDays: 5,
  autoOpen: { at: '2026-12-01T08:00', version: 2, done: true },
  autoClose: { at: '2026-12-05T17:00', done: false },
};
/** Lúc lưu: 10:00 02/12/2026 (sau giờ mở đã chạy) */
const now = '2026-12-02T10:00';

describe('khung Cấu hình thời gian', () => {
  it('cấu hình đã lưu → các ô → gửi lên đúng như cũ', () => {
    const form = formOfTimeSettings(saved, 3);
    expect(form).toEqual({
      maxProcessingDays: '5',
      autoOpen: { date: '2026-12-01', time: '08:00' },
      autoOpenVersion: 2,
      autoClose: { date: '2026-12-05', time: '17:00' },
    });
    expect(toSaveTimeSettingsRequest(form)).toEqual({
      maxProcessingDays: 5,
      autoOpen: { at: '2026-12-01T08:00', version: 2 },
      autoClose: { at: '2026-12-05T17:00' },
    });
  });

  it('chưa đặt gì: ô trống, phiên bản tự mở mặc định là phiên bản mới nhất; gửi lên toàn null', () => {
    const form = formOfTimeSettings(EMPTY_FORM_TYPE_TIME_SETTINGS, 3);
    expect(form.autoOpenVersion).toBe(3);
    expect(toSaveTimeSettingsRequest(form)).toEqual(EMPTY_FORM_TYPE_TIME_SETTINGS);
  });

  it('chọn phiên bản (kể cả trước khi nhập giờ mở) hay đổi giờ đều là thay đổi', () => {
    const empty = formOfTimeSettings(EMPTY_FORM_TYPE_TIME_SETTINGS, 3);
    expect(sameTimeSettings({ ...empty }, empty)).toBe(true);
    expect(sameTimeSettings({ ...empty, autoOpenVersion: 1 }, empty)).toBe(false);
    expect(sameTimeSettings({ ...empty, autoClose: { date: '2026-12-05', time: '17:00' } }, empty)).toBe(false);
  });

  it('giữ nguyên giờ đã chạy (đã qua) thì không lỗi', () => {
    expect(timeSettingsIssues(formOfTimeSettings(saved, 3), [1, 2, 3], saved, now)).toEqual([]);
  });

  it('gõ chưa đủ ngày, giờ thì báo ở ô đó; ô khác vẫn kiểm tra theo luật chung', () => {
    const form = { ...formOfTimeSettings(saved, 3), maxProcessingDays: '0', autoClose: { date: '2026-12-05', time: '' } };
    expect(timeSettingsIssues(form, [1, 2, 3], saved, now)).toEqual([
      { target: FORM_TYPE_TIME_ISSUE_TARGET.maxProcessingDays, message: expect.any(String) },
      { target: FORM_TYPE_TIME_ISSUE_TARGET.autoCloseAt, message: FORM_TYPE_TIME_MESSAGES.invalidTime },
    ]);
    // Ngày gõ dở
    const typing = { ...formOfTimeSettings(saved, 3), autoClose: { date: '05/12', time: '17:00' } };
    expect(timeSettingsIssues(typing, [1, 2, 3], saved, now).map((issue) => issue.message)).toEqual([FORM_TYPE_TIME_MESSAGES.invalidTime]);
  });

  it('phiên bản không có, giờ đóng trước giờ mở, sửa giờ sang ngày đã qua: báo theo thứ tự các ô', () => {
    const form = { ...formOfTimeSettings(saved, 3), autoOpen: { date: '2026-12-10', time: '08:00' }, autoOpenVersion: 9 };
    expect(timeSettingsIssues(form, [1, 2, 3], saved, now).map((issue) => issue.target)).toEqual([
      FORM_TYPE_TIME_ISSUE_TARGET.autoOpenVersion,
      FORM_TYPE_TIME_ISSUE_TARGET.autoCloseAt,
    ]);
    const past = { ...formOfTimeSettings(saved, 3), autoOpen: { date: '2026-11-30', time: '08:00' } };
    expect(timeSettingsIssues(past, [1, 2, 3], saved, now)).toEqual([{ target: FORM_TYPE_TIME_ISSUE_TARGET.autoOpenAt, message: FORM_TYPE_TIME_MESSAGES.inThePast }]);
  });
});
