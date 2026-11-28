import { describe, expect, it } from 'vitest';
import { EMAIL_SAMPLE_VALUES, deadlineTagText, fillEmailTemplate, formEmailTagValues, formLink, splitEmailTemplate, type EmailTagValues } from './email--tags';

const values: EmailTagValues = { ...EMAIL_SAMPLE_VALUES, chu_ki: 'Phòng Đào tạo' };

describe('splitEmailTemplate', () => {
  it('tách chữ thường, mã đã thay và mã lạ theo đúng thứ tự', () => {
    expect(splitEmailTemplate('Chào {ho_ten}, mã {ma_so}.', values)).toEqual([
      { kind: 'text', text: 'Chào ' },
      { kind: 'filled', tag: 'ho_ten', text: 'Nguyễn Văn An' },
      { kind: 'text', text: ', mã ' },
      { kind: 'unknown', text: '{ma_so}' },
      { kind: 'text', text: '.' },
    ]);
  });

  it('không có mã thì một đoạn chữ; chuỗi trống thì không có đoạn nào', () => {
    expect(splitEmailTemplate('Xin chào', values)).toEqual([{ kind: 'text', text: 'Xin chào' }]);
    expect(splitEmailTemplate('', values)).toEqual([]);
  });
});

describe('fillEmailTemplate', () => {
  it('thay mọi mã, kể cả mã lặp lại; mã lạ giữ nguyên', () => {
    expect(fillEmailTemplate('[{ma_don}] {ma_don} {la}\n{chu_ki}', values)).toBe('[XMR-2026-001-00001] XMR-2026-001-00001 {la}\nPhòng Đào tạo');
  });
});

describe('formEmailTagValues', () => {
  it('điền mã từ lá đơn: ngày nộp dd/mm/yyyy, hạn giờ · ngày, đường dẫn tới đơn, chưa có người xử lí, người chuyển giao thì chữ trống', () => {
    const deadline = { state: 'onTrack' as const, maxDays: 3, dueAt: '2026-11-10T08:30', remainingMinutes: 2000 };
    const form = { applicantName: 'Lê Văn B', code: 'XMM-2026-001-00007', formTypeName: 'Xét miễn môn', submittedAt: '2026-11-05T08:30', handlerName: null, note: '', deadline };
    expect(formEmailTagValues(form, 'PĐT', 'http://localhost:5173/')).toEqual({
      ho_ten: 'Lê Văn B',
      ma_don: 'XMM-2026-001-00007',
      loai_don: 'Xét miễn môn',
      ngay_nop: '05/11/2026',
      han_xu_li: '08:30 · 10/11/2026',
      nguoi_xu_li: '',
      nguoi_chuyen_giao: '',
      ly_do: '',
      link_don: 'http://localhost:5173/#/don/XMM-2026-001-00007',
      chu_ki: 'PĐT',
    });
  });

  it('điền người chuyển giao khi có (thư chuyển giao)', () => {
    const deadline = { state: 'none' as const, maxDays: null, dueAt: null, remainingMinutes: null };
    const form = { applicantName: 'A', code: 'A-1', formTypeName: 'T', submittedAt: '2026-11-05T08:30', handlerName: 'Hà', note: '', deadline, transferrerName: 'Tuấn' };
    expect(formEmailTagValues(form, '', 'http://x')).toMatchObject({ nguoi_xu_li: 'Hà', nguoi_chuyen_giao: 'Tuấn' });
  });
});

describe('deadlineTagText', () => {
  it('có hạn: giờ · ngày; không giới hạn; đang chờ bổ sung', () => {
    expect(deadlineTagText({ state: 'overdue', maxDays: 2, dueAt: '2026-11-06T09:30', remainingMinutes: -10 })).toBe('09:30 · 06/11/2026');
    expect(deadlineTagText({ state: 'none', maxDays: null, dueAt: null, remainingMinutes: null })).toBe('Không giới hạn');
    expect(deadlineTagText({ state: 'onTrack', maxDays: 5, dueAt: null, remainingMinutes: 3000 })).toBe('Chưa có, chờ bổ sung');
  });
});

describe('formLink', () => {
  it('đường dẫn tới đơn: bỏ dấu / thừa ở cuối địa chỉ gốc', () => {
    expect(formLink('https://dichvu.hcmulaw.edu.vn', 'A-1')).toBe('https://dichvu.hcmulaw.edu.vn/#/don/A-1');
    expect(formLink('https://dichvu.hcmulaw.edu.vn//', 'A-1')).toBe('https://dichvu.hcmulaw.edu.vn/#/don/A-1');
  });
});
