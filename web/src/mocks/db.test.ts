import { beforeEach, describe, expect, test } from 'vitest';
import { QUESTION_TYPES, type FileRef } from '@ulaw/shared';
import {
  addForm,
  decideForm,
  getFormDetail,
  getFormsHandledBy,
  getFormsOf,
  getFormType,
  getOpenFormTypes,
  getProfile,
  getFilesOfForm,
  getSavedFileIds,
  getStudents,
  findPerson,
  getTransferTargets,
  transferForm,
  isCccdTaken,
  resetMockDb,
  saveMainStudent,
  saveProfile,
  toSession,
  receiveForm,
  updateForm,
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

describe('chi tiết đơn', () => {
  test('người nộp xem được đơn của mình, đủ nội dung như bản mẫu', () => {
    const form = getFormDetail('XMM-2026-01520', { id: 'sv-1', role: 'nguoiNopDon' });
    expect(form).toMatchObject({
      status: 'nop',
      note: '',
      applicant: { id: 'sv-1', name: 'Nguyễn Minh Anh' },
      receiver: null,
      handler: null,
    });
    expect(form?.sections.map((section) => section.id)).toEqual(['s-mon', 's-files']);
    expect(form?.answers.mon).toEqual([['Triết học Mác – Lênin', 3, 'Triết học Mác – Lênin', 'ĐH KHXH&NV – ĐHQG TP.HCM']]);
    expect(form?.answers.files).toMatchObject([{ name: 'Bang_diem_toan_khoa_1.pdf' }]);
  });

  test('đơn Cần bổ sung có lí do, người tiếp nhận và người xử lí', () => {
    const supplementForm = getFormsOf('sv-1').find((form) => form.status === 'bs')!;
    const form = getFormDetail(supplementForm.code, { id: 'sv-1', role: 'nguoiNopDon' })!;
    expect(form.note).toMatch(/Bảng điểm chưa có dấu xác nhận/);
    expect(form.receiver).not.toBeNull();
    expect(form.receivedAt! > form.submittedAt).toBe(true);
    expect(form.handlerSince! >= form.receivedAt!).toBe(true);
  });

  test('người nộp đơn không xem được đơn người khác; cán bộ xem được; mã không có thì null', () => {
    const otherCode = getFormsHandledBy('cb-1').find((form) => !getFormsOf('sv-1').some((own) => own.code === form.code))!.code;
    expect(getFormDetail(otherCode, { id: 'sv-1', role: 'nguoiNopDon' })).toBeNull();
    expect(getFormDetail(otherCode, { id: 'cb-1', role: 'nguoiXuLiDon' })?.applicant.id).toMatch(/^sv-([2-9]|1[01])$/);
    expect(getFormDetail('XMM-2026-99999', { id: 'cb-3', role: 'admin' })).toBeNull();
  });
});

describe('sửa đơn', () => {
  test('đơn Cần bổ sung lưu xong thành Đã bổ sung; tệp cũ giữ id, tệp mới có id ở máy chủ; giờ cập nhật đổi', () => {
    const supplementCode = getFormsOf('sv-1').find((form) => form.status === 'bs')!.code;
    const before = getFormDetail(supplementCode, { id: 'sv-1', role: 'nguoiNopDon' })!;
    const oldFile = (before.answers.files as FileRef[])[0]!;
    const newFile = { id: 'local-9', name: 'ban-co-xac-nhan.pdf', sizeBytes: 4 };

    const saved = updateForm(supplementCode, { mon: [['Logic học', 2, 'Logic', 'ĐH Mở']], files: [oldFile, newFile] }, new Map([['local-9', new File(['%PDF'], 'ban-co-xac-nhan.pdf')]]))!;
    expect(saved.status).toBe('bsg');
    expect(saved.updatedAt).not.toBe(before.updatedAt);
    expect(saved.answers.mon).toEqual([['Logic học', 2, 'Logic', 'ĐH Mở']]);
    const files = saved.answers.files as FileRef[];
    expect(files[0]).toEqual(oldFile);
    expect(files[1]).toMatchObject({ name: 'ban-co-xac-nhan.pdf' });
    expect(files[1]!.id).not.toBe('local-9');
    expect(getSavedFileIds(supplementCode)).toEqual(new Set(files.map((file) => file.id)));
  });

  test('gỡ tệp rồi lưu: tệp bị xóa hẳn, không còn trong kho tệp', () => {
    const xmm = getFormType('xmm', false)!;
    const files = [new File(['%PDF'], 'a.pdf'), new File(['%PDF'], 'b.pdf')];
    const answers = { mon: [['Logic học', 2, 'Logic', 'ĐH Mở']], files: files.map((file, i) => ({ id: `local-${i}`, name: file.name, sizeBytes: 4 })) };
    const { code } = addForm('sv-1', xmm, answers, new Map(files.map((file, i) => [`local-${i}`, file])));
    const [keptFile, removedFile] = getFilesOfForm(code);

    updateForm(code, { ...answers, files: [keptFile!] }, new Map());
    expect(getFilesOfForm(code)).toEqual([keptFile]);
    expect(getSavedFileIds(code).has(removedFile!.id)).toBe(false);
  });
});

describe('tiếp nhận đơn', () => {
  test('đơn Đã bổ sung: thành Đang xét, cán bộ bấm là người tiếp nhận và người xử lí, lí do cũ được xóa', () => {
    const supplementedCode = getFormsOf('sv-1').find((form) => form.status === 'bsg')!.code;
    const before = getFormDetail(supplementedCode, { id: 'cb-1', role: 'nguoiXuLiDon' })!;
    expect(before.note).not.toBe('');

    const received = receiveForm(supplementedCode, 'cb-1')!;
    expect(received.status).toBe('xet');
    expect(received.note).toBe('');
    expect(received.receiver?.id).toBe('cb-1');
    expect(received.handler?.id).toBe('cb-1');
    expect(received.handlerSince).toBe(received.receivedAt);
    expect(received.updatedAt).toBe(before.updatedAt);
  });
});

describe('ra quyết định về đơn', () => {
  /** Mã một đơn Đang xét của sinh viên mẫu. */
  const underReviewCode = () => getFormsOf('sv-1').find((form) => form.status === 'xet')!.code;

  test('Yêu cầu bổ sung: chuyển sang Cần bổ sung và lưu lí do', () => {
    const decidedForm = decideForm(underReviewCode(), 'bs', 'Thiếu bảng điểm')!;
    expect(decidedForm.status).toBe('bs');
    expect(decidedForm.note).toBe('Thiếu bảng điểm');
  });

  test('Từ chối: chuyển sang Từ chối và lưu lí do', () => {
    const decidedForm = decideForm(underReviewCode(), 'tc', 'Không đủ điều kiện')!;
    expect(decidedForm.status).toBe('tc');
    expect(decidedForm.note).toBe('Không đủ điều kiện');
  });

  test('Duyệt: chuyển sang Đã duyệt và xóa lí do', () => {
    const decidedForm = decideForm(underReviewCode(), 'duyet', 'ghi chú cũ')!;
    expect(decidedForm.status).toBe('duyet');
    expect(decidedForm.note).toBe('');
  });

  test('không đổi người xử lí và lần lưu gần nhất của đơn', () => {
    const code = underReviewCode();
    const before = getFormDetail(code, { id: 'cb-3', role: 'admin' })!;
    const decidedForm = decideForm(code, 'bs', '')!;
    expect(decidedForm.handler).toEqual(before.handler);
    expect(decidedForm.updatedAt).toBe(before.updatedAt);
  });

  test('trả về null khi không có đơn', () => {
    expect(decideForm('XMM-0000-00000', 'duyet', '')).toBeNull();
  });
});

describe('chuyển giao đơn', () => {
  /** Mã một đơn Đang xét của sinh viên mẫu và người đang xử lí nó. */
  const underReview = () => {
    const code = getFormsOf('sv-1').find((form) => form.status === 'xet')!.code;
    return { code, handler: getFormDetail(code, { id: 'cb-3', role: 'admin' })!.handler! };
  };

  test('danh sách cán bộ nhận không có người đang xử lí', () => {
    const { code, handler } = underReview();
    const targets = getTransferTargets(code)!;
    expect(targets.length).toBeGreaterThan(0);
    expect(targets.map((staff) => staff.id)).not.toContain(handler.id);
  });

  test('chuyển giao: đổi người xử lí, ghi mốc phụ trách mới, giữ người tiếp nhận và trạng thái', () => {
    const { code, handler } = underReview();
    const before = getFormDetail(code, { id: 'cb-3', role: 'admin' })!;
    const newHandler = getTransferTargets(code)![0]!;
    const transferred = transferForm(code, newHandler.id)!;
    expect(transferred.handler).toEqual(newHandler);
    expect(transferred.handler?.id).not.toBe(handler.id);
    expect(transferred.handlerSince).not.toBe(before.handlerSince);
    expect(transferred.receiver).toEqual(before.receiver);
    expect(transferred.status).toBe(before.status);
  });

  test('trả về null khi không có đơn hoặc không có cán bộ nhận', () => {
    const { code } = underReview();
    expect(transferForm('XMM-0000-00000', 'cb-2')).toBeNull();
    expect(transferForm(code, 'khong-co')).toBeNull();
    expect(getTransferTargets('XMM-0000-00000')).toBeNull();
  });
});

describe('tìm người dùng theo id', () => {
  test('thấy sinh viên đăng nhập thử (họ tên theo hồ sơ), cán bộ và sinh viên khác', () => {
    expect(findPerson('sv-1')).toMatchObject({ name: 'Nguyễn Minh Anh', email: 'minhanh.nguyen@hcmulaw.edu.vn' });
    expect(findPerson('cb-2')).toMatchObject({ name: 'Trần Quốc Việt' });
    expect(findPerson('sv-2')?.email).toBe('baongoc.tran@hcmulaw.edu.vn');
  });

  test('người chưa có hồ sơ riêng (sinh viên khác) chưa có SĐT, CCCD, MSSV', () => {
    expect(findPerson('sv-2')).toMatchObject({ phone: null, cccd: null, students: [] });
  });

  test('có hồ sơ riêng thì lấy SĐT, CCCD, MSSV từ đó', () => {
    expect(findPerson('cb-1')).toMatchObject({ phone: '0912345678', cccd: '079188001122' });
    expect(findPerson('sv-1')?.students).toHaveLength(2);
  });

  test('trả về null khi không có người dùng', () => {
    expect(findPerson('khong-co')).toBeNull();
  });
});
