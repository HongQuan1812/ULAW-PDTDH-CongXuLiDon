import { beforeEach, describe, expect, test } from 'vitest';
import { QUESTION_TYPES } from '@ulaw/shared';
import {
  addForm,
  getFormsHandledBy,
  getFormsOf,
  getFormType,
  getOpenFormTypes,
  getProfile,
  getFilesOfForm,
  getStudents,
  isCccdTaken,
  resetMockDb,
  saveMainStudent,
  saveProfile,
  toSession,
} from './db';

beforeEach(() => {
  resetMockDb();
});

describe('hồ sơ ban đầu', () => {
  test('sinh viên mẫu chưa bổ sung thông tin lần đầu, chưa có CCCD và SĐT', () => {
    const profile = getProfile('sv-1');
    expect(profile.completed).toBe(false);
    expect(profile.cccd).toBeNull();
    expect(profile.phone).toBeNull();
  });

  test('cán bộ mẫu đã bổ sung thông tin', () => {
    expect(getProfile('cb-1').completed).toBe(true);
  });
});

describe('saveProfile', () => {
  test('lưu họ tên, CCCD, SĐT và đánh dấu đã bổ sung thông tin', () => {
    const saved = saveProfile('sv-1', { name: 'Nguyễn Minh Anh', cccd: '079206001234', phone: '0901234567' });
    expect(saved).toEqual({
      name: 'Nguyễn Minh Anh',
      cccd: '079206001234',
      phone: '0901234567',
      completed: true,
      mainStudentId: null,
    });
    expect(getProfile('sv-1')).toEqual(saved);
  });

  test('chuỗi rỗng nghĩa là xóa CCCD và SĐT (lưu null)', () => {
    saveProfile('sv-1', { name: 'Nguyễn Minh Anh', cccd: '079206001234', phone: '0901234567' });
    const saved = saveProfile('sv-1', { name: 'Nguyễn Minh Anh', cccd: '', phone: '' });
    expect(saved.cccd).toBeNull();
    expect(saved.phone).toBeNull();
  });
});

describe('MSSV', () => {
  test('sinh viên mẫu có 2 MSSV, cán bộ không có MSSV nào', () => {
    expect(getStudents('sv-1')).toHaveLength(2);
    expect(getStudents('cb-1')).toEqual([]);
  });

  test('lưu MSSV chính, và lưu hồ sơ sau đó không làm mất MSSV chính', () => {
    saveMainStudent('sv-1', '2523801040017');
    expect(getProfile('sv-1').mainStudentId).toBe('2523801040017');
    saveProfile('sv-1', { name: 'Nguyễn Minh Anh', cccd: '', phone: '' });
    expect(getProfile('sv-1').mainStudentId).toBe('2523801040017');
  });
});

describe('isCccdTaken', () => {
  test('true khi CCCD thuộc tài khoản khác', () => {
    const cccdOfStaff = getProfile('cb-1').cccd as string;
    expect(isCccdTaken(cccdOfStaff, 'sv-1')).toBe(true);
  });

  test('false khi CCCD là của chính mình hoặc chưa ai dùng', () => {
    const cccdOfStaff = getProfile('cb-1').cccd as string;
    expect(isCccdTaken(cccdOfStaff, 'cb-1')).toBe(false);
    expect(isCccdTaken('079200009999', 'sv-1')).toBe(false);
  });
});

describe('toSession', () => {
  test('phản ánh họ tên mới và trạng thái đã bổ sung thông tin', () => {
    expect(toSession('nguoiNopDon').profileCompleted).toBe(false);
    saveProfile('sv-1', { name: 'Nguyễn Minh Anh Thư', cccd: '', phone: '' });
    const session = toSession('nguoiNopDon');
    expect(session.profileCompleted).toBe(true);
    expect(session.user.name).toBe('Nguyễn Minh Anh Thư');
  });
});

describe('đơn đã nộp', () => {
  test('sinh viên mẫu có 18 đơn đủ các trạng thái, mã đơn không trùng; cán bộ chưa có đơn', () => {
    const forms = getFormsOf('sv-1');
    expect(forms).toHaveLength(18);
    expect(new Set(forms.map((form) => form.code)).size).toBe(18);
    expect(new Set(forms.map((form) => form.status))).toEqual(new Set(['nop', 'xet', 'bs', 'bsg', 'duyet', 'tc']));
    expect(forms[0]).toMatchObject({ code: 'XMM-2026-01520', submittedAt: '2026-10-30T07:00', status: 'nop' });
    expect(getFormsOf('cb-1')).toEqual([]);
  });
});

describe('loại đơn', () => {
  test('chỉ trả loại đơn Đang mở, không kèm trạng thái', () => {
    expect(getOpenFormTypes()).toEqual([
      { id: 'xmm', name: 'Xét miễn môn', prefix: 'XMM', description: 'Miễn môn đã học tương đương ở cơ sở đào tạo khác' },
      {
        id: 'thu',
        name: 'Đơn thử nghiệm (đủ loại câu hỏi)',
        prefix: 'THU',
        description: 'Có đủ 10 loại câu hỏi, để xem giao diện của từng loại',
      },
    ]);
  });

  test('loại đơn đủ cấu trúc: Xét miễn môn như bản mẫu, đơn thử nghiệm có đủ 10 loại câu hỏi', () => {
    const xmm = getFormType('xmm', false);
    expect(xmm?.sections.map((section) => section.id)).toEqual(['s-mon', 's-files']);
    expect(xmm?.sections[0]?.main).toBe(true);

    const testFormType = getFormType('thu', false);
    const questionTypes = new Set(testFormType?.sections.flatMap((section) => section.questions.map((question) => question.type)));
    expect(questionTypes).toEqual(new Set(QUESTION_TYPES));

    expect(getFormType('khong-co', true)).toBeNull();
  });
});

describe('đơn phụ trách', () => {
  test('mỗi cán bộ thấy đơn mình tiếp nhận hoặc đang xử lí, có cả đơn đã chuyển giao; đơn Đã nộp chưa ai phụ trách', () => {
    const handledByStaff = ['cb-1', 'cb-2', 'cb-3'].map((staffId) => getFormsHandledBy(staffId));
    handledByStaff.forEach((forms, i) => {
      expect(forms.length).toBeGreaterThan(0);
      forms.forEach((form) => {
        expect([form.receiver?.id, form.handler?.id]).toContain(`cb-${i + 1}`);
        expect(form.status).not.toBe('nop');
      });
    });
    const transferred = handledByStaff.flat().filter((form) => form.receiver?.id !== form.handler?.id);
    expect(transferred.length).toBeGreaterThan(0);
    expect(getFormsHandledBy('sv-1')).toEqual([]);
  });
});

describe('nộp đơn mới', () => {
  test('sinh mã kế tiếp của tiền tố và năm, trạng thái Đã nộp, đứng đầu bảng Đơn đã nộp; tệp lưu cùng đơn với id mới', () => {
    const xmm = getFormType('xmm', false)!;
    const bangDiem = new File(['%PDF'], 'bang-diem.pdf');
    const answers = { mon: [['Triết học', 3, 'Triết học', 'ĐH KHXH&NV']], files: [{ id: 'local-1', name: 'bang-diem.pdf', sizeBytes: 4 }] };

    // Mã lớn nhất hiện có của XMM cùng năm
    const year = new Date().getFullYear();
    const sameYearSequences = getFormsOf('sv-1')
      .concat(...['cb-1', 'cb-2', 'cb-3'].map((staffId) => getFormsHandledBy(staffId)))
      .map((form) => form.code)
      .filter((code) => code.startsWith(`XMM-${year}-`))
      .map((code) => Number(code.slice(-5)));

    // Nộp xong: mã kế tiếp, Đã nộp, đứng đầu bảng
    const newForm = addForm('sv-1', xmm, answers, new Map([['local-1', bangDiem]]));
    expect(newForm.code).toMatch(new RegExp(`^XMM-${year}-[0-9]{5}$`));
    expect(Number(newForm.code.slice(-5))).toBeGreaterThan(Math.max(0, ...sameYearSequences));
    expect(newForm.status).toBe('nop');
    expect(getFormsOf('sv-1')[0]).toEqual(newForm);

    // Tệp được lưu cùng đơn, id do máy chủ đặt
    const savedFiles = getFilesOfForm(newForm.code);
    expect(savedFiles).toHaveLength(1);
    expect(savedFiles[0]).toMatchObject({ name: 'bang-diem.pdf', sizeBytes: 4 });
    expect(savedFiles[0]!.id).not.toBe('local-1');
  });
});
