import { describe, expect, it } from 'vitest';
import { EMPTY_FORM_TYPE_TIME_SETTINGS, FORM_TYPE_TIME_MESSAGES, type FormTypeTimeSettings } from '../api-contract/form-types';
import { dueScheduleSteps, markScheduleStepDone, pendingCloseAt, scheduledStatusChangeOf, timeSettingsAfterSave } from './form-types--schedule';

/** Hẹn mở phiên bản 2 lúc 08:00 01/12, đóng lúc 17:00 05/12; chưa chạy. */
const scheduled = (): FormTypeTimeSettings => ({
  maxProcessingDays: 5,
  autoOpen: { at: '2026-12-01T08:00', version: 2, done: false },
  autoClose: { at: '2026-12-05T17:00', done: false },
});

describe('dueScheduleSteps', () => {
  it('chưa tới giờ thì không có việc', () => {
    expect(dueScheduleSteps(scheduled(), '2026-12-01T07:59')).toEqual([]);
  });

  it('đúng phút hẹn thì chạy, bỏ qua phần giây', () => {
    expect(dueScheduleSteps(scheduled(), '2026-12-01T08:00:30.000')).toEqual([{ kind: 'open', at: '2026-12-01T08:00', version: 2 }]);
  });

  it('máy chủ tắt qua cả hai giờ thì mở trước, đóng sau', () => {
    expect(dueScheduleSteps(scheduled(), '2026-12-06T09:00').map((step) => step.kind)).toEqual(['open', 'close']);
  });

  it('đã đánh dấu chạy thì không chạy lại (restart)', () => {
    const opened = markScheduleStepDone(scheduled(), 'open');
    expect(dueScheduleSteps(opened, '2026-12-02T09:00')).toEqual([]);
    expect(dueScheduleSteps(markScheduleStepDone(opened, 'close'), '2026-12-06T09:00')).toEqual([]);
  });

  it('không hẹn giờ thì không có việc', () => {
    expect(dueScheduleSteps(EMPTY_FORM_TYPE_TIME_SETTINGS, '2026-12-06T09:00')).toEqual([]);
  });
});

describe('scheduledStatusChangeOf', () => {
  const openStep = { kind: 'open', at: '2026-12-01T08:00', version: 2 } as const;
  const closeStep = { kind: 'close', at: '2026-12-05T17:00' } as const;

  it('tự mở bản Nháp hoặc bản đã đóng', () => {
    expect(scheduledStatusChangeOf(openStep, [{ version: 2, status: 'draft' }, { version: 1, status: 'open' }])).toEqual({ version: 2, status: 'open' });
    expect(scheduledStatusChangeOf(openStep, [{ version: 2, status: 'closed' }])).toEqual({ version: 2, status: 'open' });
  });

  it('phiên bản đã mở sẵn (bấm tay trước) hoặc không còn thì không đổi gì', () => {
    expect(scheduledStatusChangeOf(openStep, [{ version: 2, status: 'open' }])).toBeNull();
    expect(scheduledStatusChangeOf(openStep, [{ version: 1, status: 'closed' }])).toBeNull();
  });

  it('tự đóng phiên bản đang mở, kể cả phiên bản mở tay', () => {
    expect(scheduledStatusChangeOf(closeStep, [{ version: 3, status: 'draft' }, { version: 1, status: 'open' }])).toEqual({ version: 1, status: 'closed' });
  });

  it('đã đóng sớm thì tới giờ đóng không đổi gì', () => {
    expect(scheduledStatusChangeOf(closeStep, [{ version: 2, status: 'closed' }])).toBeNull();
  });
});

describe('timeSettingsAfterSave', () => {
  const ran = markScheduleStepDone(markScheduleStepDone(scheduled(), 'open'), 'close');

  it('giữ nguyên giờ thì giữ dấu đã chạy; đổi thời gian xử lí không ảnh hưởng', () => {
    const saved = timeSettingsAfterSave(ran, { maxProcessingDays: 10, autoOpen: { at: '2026-12-01T08:00', version: 2 }, autoClose: { at: '2026-12-05T17:00' } });
    expect(saved).toEqual({ ...ran, maxProcessingDays: 10 });
  });

  it('sửa sang giờ khác (hẹn đợt mới) thì bỏ dấu', () => {
    const saved = timeSettingsAfterSave(ran, { maxProcessingDays: 5, autoOpen: { at: '2027-01-04T08:00', version: 2 }, autoClose: { at: '2027-01-08T17:00' } });
    expect(saved.autoOpen?.done).toBe(false);
    expect(saved.autoClose?.done).toBe(false);
  });

  it('cùng giờ, chỉ đổi phiên bản tự mở thì vẫn giữ dấu', () => {
    const saved = timeSettingsAfterSave(ran, { maxProcessingDays: 5, autoOpen: { at: '2026-12-01T08:00', version: 3 }, autoClose: { at: '2026-12-05T17:00' } });
    expect(saved.autoOpen).toEqual({ at: '2026-12-01T08:00', version: 3, done: true });
  });

  it('xóa trống là bỏ hẹn; hẹn mới thì chưa chạy', () => {
    expect(timeSettingsAfterSave(ran, { maxProcessingDays: null, autoOpen: null, autoClose: null })).toEqual(EMPTY_FORM_TYPE_TIME_SETTINGS);
    const fresh = timeSettingsAfterSave(EMPTY_FORM_TYPE_TIME_SETTINGS, { maxProcessingDays: null, autoOpen: null, autoClose: { at: '2026-12-05T17:00' } });
    expect(fresh.autoClose).toEqual({ at: '2026-12-05T17:00', done: false });
  });
});

describe('pendingCloseAt', () => {
  it('chỉ có khi hẹn đóng chưa chạy', () => {
    expect(pendingCloseAt(scheduled())).toBe('2026-12-05T17:00');
    expect(pendingCloseAt(markScheduleStepDone(scheduled(), 'close'))).toBeNull();
    expect(pendingCloseAt(EMPTY_FORM_TYPE_TIME_SETTINGS)).toBeNull();
  });

  it('câu hạn nhận đơn ghi giờ trước, ngày sau', () => {
    expect(FORM_TYPE_TIME_MESSAGES.acceptsUntil('2026-12-05T17:00')).toBe('Nhận đơn đến 17:00 05/12/2026');
  });
});
