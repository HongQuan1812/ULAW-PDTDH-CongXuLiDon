import { beforeEach, describe, expect, test } from 'vitest';
import { FORM_TYPE_SEED, MULTI_VERSION_SEED_FORM_TYPE_ID, type FileRef } from '@ulaw/shared';
import {
  addForm,
  addFormTypeVersion,
  createFormType,
  decideForm,
  deleteHoliday,
  getHolidays,
  saveHoliday,
  deleteFormTypeVersion,
  getFormTypeSummaries,
  getManagedFormType,
  saveFormTypeVersion,
  setFormTypeVersionStatus,
  getAllForms,
  getApplicantCccds,
  getFileContent,
  getFormDetail,
  getFormStats,
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
  createAccount,
  demoAccountFor,
  getAccountCccds,
  getAccounts,
  updateAccount,
  updateForm,
} from './db';

/** Câu trả lời hợp lệ của loại đơn chính xmr: bảng học phần, cơ sở đào tạo, tệp minh chứng. */
const xmrAnswers = (rows: (string | number)[][], files: FileRef[]) => ({
  'hoc-phan': rows,
  'co-so-dao-tao': 'ĐH Mở TP.HCM',
  'hinh-thuc-dao-tao': 'Chính quy',
  'minh-chung': files,
});

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
      email: 'minhanh.nguyen@hcmulaw.edu.vn',
      role: 'nguoiNopDon',
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
    expect(toSession('sv-1').profileCompleted).toBe(false);
    saveProfile('sv-1', { name: 'Nguyễn Minh Anh Thư', cccd: '', phone: '' });
    const session = toSession('sv-1');
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
    expect(forms[0]).toMatchObject({ code: 'XMR-2026-001-01520', submittedAt: '2026-10-30T07:00', status: 'nop' });
    expect(getFormsOf('cb-1')).toEqual([]);
  });
});

describe('loại đơn', () => {
  test('chỉ trả loại đơn Đang mở, không kèm trạng thái', () => {
    const openFormTypes = getOpenFormTypes();
    expect(openFormTypes.map((formType) => formType.id)).toEqual(FORM_TYPE_SEED.map((formType) => formType.id));
    expect(openFormTypes[0]).toEqual({ id: 'dkhpm', name: 'Đăng ký học phần muộn', prefix: 'DKHPM', description: FORM_TYPE_SEED[0]!.description });
  });

  test('loại đơn đủ cấu trúc: loại đơn chính đủ các phần; loại đơn nhiều phiên bản trả phiên bản đang mở', () => {
    const xmr = getFormType('xmr');
    expect(xmr?.sections.map((section) => section.id)).toEqual(['s-hoc-phan', 's-minh-chung']);
    expect(xmr?.sections[0]?.main).toBe(true);
    expect(getFormType(MULTI_VERSION_SEED_FORM_TYPE_ID)?.version).toBe(2);
    expect(getFormType('khong-co')).toBeNull();
  });
});

describe('phiên bản loại đơn', () => {
  /** Bản soạn hợp lệ dựng từ phiên bản đang mở của loại đơn chính xmr, đổi tên và trạng thái. */
  const xmrInput = (name: string, status: 'draft' | 'open') => {
    const { prefix, description, maxProcessingDays, sections } = getFormType('xmr')!;
    return { prefix, name, description, maxProcessingDays, status, sections };
  };

  test('thêm phiên bản Nháp; đang có Nháp thì không thêm được nữa; phiên bản đã khóa không sửa được', () => {
    const added = addFormTypeVersion('xmr', xmrInput('Xét miễn môn mới', 'draft'), 'cb-1');
    expect(added.ok && added.formType.versions.map((version) => [version.version, version.status])).toEqual([
      [2, 'draft'],
      [1, 'open'],
    ]);
    expect(added.ok && added.formType.versions[0]!.maxProcessingDays).toBe(10);
    expect(saveFormTypeVersion('xmr', 2, { ...xmrInput('Xét miễn môn mới', 'draft'), maxProcessingDays: 3 }, 'cb-1')).toMatchObject({
      ok: true,
      formType: { versions: [{ version: 2, maxProcessingDays: 3 }, { version: 1, maxProcessingDays: 10 }] },
    });
    expect(addFormTypeVersion('xmr', xmrInput('Bản khác', 'draft'), 'cb-1')).toMatchObject({ ok: false, status: 409 });
    expect(saveFormTypeVersion('xmr', 1, xmrInput('Sửa bản đã khóa', 'draft'), 'cb-1')).toMatchObject({ ok: false, status: 409 });

    // Bảng Quản lí loại đơn hiện phiên bản mới nhất, phiên bản cũ xổ ra
    const row = getFormTypeSummaries().find((formType) => formType.id === 'xmr')!;
    expect([row.version, row.status, row.name]).toEqual([2, 'draft', 'Xét miễn môn mới']);
    expect(row.olderVersions.map((version) => version.version)).toEqual([1]);
  });

  test('mở phiên bản mới thì phiên bản đang mở tự đóng; nộp đơn theo phiên bản đang mở, mã đơn có số phiên bản', () => {
    addFormTypeVersion('xmr', xmrInput('Xét miễn môn mới', 'draft'), 'cb-1');
    saveFormTypeVersion('xmr', 2, xmrInput('Xét miễn môn mới', 'open'), 'cb-1');
    expect(getManagedFormType('xmr')!.versions.map((version) => version.status)).toEqual(['open', 'closed']);
    expect(getFormType('xmr')).toMatchObject({ version: 2, name: 'Xét miễn môn mới' });

    const year = new Date().getFullYear();
    const newForm = addForm('sv-1', 'sv-1', getFormType('xmr')!, xmrAnswers([['Triết học', 3, 'Triết học', '3 TC', 8]], []), new Map());
    expect(newForm.code).toMatch(new RegExp(`^XMR-${year}-002-[0-9]{5}$`));

    // Mở lại phiên bản 1: phiên bản 2 tự đóng
    setFormTypeVersionStatus('xmr', 1, 'open', 'cb-2');
    expect(getManagedFormType('xmr')!.versions.map((version) => version.status)).toEqual(['closed', 'open']);
    expect(setFormTypeVersionStatus('xmr', 3, 'open', 'cb-2')).toMatchObject({ ok: false, status: 404 });
  });

  test('chỉ xóa được phiên bản Nháp; phiên bản duy nhất thì xóa luôn loại đơn; mã đơn khóa khi đã mở', () => {
    expect(deleteFormTypeVersion('xmr', 1)).toMatchObject({ ok: false, status: 409 });

    const created = createFormType({ ...xmrInput('Xin bảo lưu', 'draft'), prefix: 'BL' }, 'cb-1');
    expect([created.id, created.prefixLocked]).toEqual(['bl', false]);
    expect(deleteFormTypeVersion('bl', 1)).toEqual({ ok: true, formType: null });
    expect(getManagedFormType('bl')).toBeNull();

    // Đã mở: mã đơn khóa, đổi mã khi thêm phiên bản thì 409
    expect(getManagedFormType('xmr')!.prefixLocked).toBe(true);
    expect(addFormTypeVersion('xmr', { ...xmrInput('Đổi mã', 'draft'), prefix: 'XM' }, 'cb-1')).toMatchObject({ ok: false, status: 409 });
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
    const xmr = getFormType('xmr')!;
    const bangDiem = new File(['%PDF'], 'bang-diem.pdf');
    const answers = xmrAnswers([['Triết học', 3, 'Triết học', '3 TC', 8]], [{ id: 'local-1', name: 'bang-diem.pdf', sizeBytes: 4 }]);

    // Mã lớn nhất hiện có của XMR cùng năm
    const year = new Date().getFullYear();
    const sameYearSequences = getFormsOf('sv-1')
      .concat(...['cb-1', 'cb-2', 'cb-3'].map((staffId) => getFormsHandledBy(staffId)))
      .map((form) => form.code)
      .filter((code) => code.startsWith(`XMR-${year}-`))
      .map((code) => Number(code.slice(-5)));

    // Nộp xong: mã kế tiếp, Đã nộp, đứng đầu bảng
    const newForm = addForm('sv-1', 'sv-1', xmr, answers, new Map([['local-1', bangDiem]]));
    expect(newForm.code).toMatch(new RegExp(`^XMR-${year}-001-[0-9]{5}$`));
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
  test('người nộp xem được đơn của mình, đủ nội dung', () => {
    const form = getFormDetail('XMR-2026-001-01520', { id: 'sv-1', role: 'nguoiNopDon' });
    expect(form).toMatchObject({
      status: 'nop',
      note: '',
      applicant: { id: 'sv-1', name: 'Nguyễn Minh Anh' },
      receiver: null,
      handler: null,
    });
    expect(form?.sections.map((section) => section.id)).toEqual(['s-hoc-phan', 's-minh-chung']);
    expect(form?.answers['hoc-phan']).toEqual([['Triết học Mác – Lênin', 3, 'Triết học Mác – Lênin', '3 TC', 7]]);
    expect(form?.answers['minh-chung']).toMatchObject([{ name: 'Bang_diem_toan_khoa_1.pdf' }]);
  });

  test('đơn Cần bổ sung có lí do, người tiếp nhận và người xử lí', () => {
    const supplementForm = getFormsOf('sv-1').find((form) => form.status === 'bs')!;
    const form = getFormDetail(supplementForm.code, { id: 'sv-1', role: 'nguoiNopDon' })!;
    expect(form.note).toMatch(/Giấy tờ minh chứng chưa có dấu xác nhận/);
    expect(form.receiver).not.toBeNull();
    expect(form.receivedAt! > form.submittedAt).toBe(true);
    expect(form.handlerSince! >= form.receivedAt!).toBe(true);
  });

  test('người nộp đơn không xem được đơn người khác; cán bộ xem được; mã không có thì null', () => {
    const otherCode = getFormsHandledBy('cb-1').find((form) => !getFormsOf('sv-1').some((own) => own.code === form.code))!.code;
    expect(getFormDetail(otherCode, { id: 'sv-1', role: 'nguoiNopDon' })).toBeNull();
    expect(getFormDetail(otherCode, { id: 'cb-1', role: 'nguoiXuLiDon' })?.applicant.id).toMatch(/^sv-([2-9]|1[01])$/);
    expect(getFormDetail('XMR-2026-001-99999', { id: 'cb-3', role: 'admin' })).toBeNull();
  });
});

describe('sửa đơn', () => {
  test('đơn Cần bổ sung lưu xong thành Đã bổ sung; tệp cũ giữ id, tệp mới có id ở máy chủ; giờ cập nhật đổi', () => {
    const supplementCode = getFormsOf('sv-1').find((form) => form.status === 'bs')!.code;
    const before = getFormDetail(supplementCode, { id: 'sv-1', role: 'nguoiNopDon' })!;
    const oldFile = (before.answers['minh-chung'] as FileRef[])[0]!;
    const newFile = { id: 'local-9', name: 'ban-co-xac-nhan.pdf', sizeBytes: 4 };

    const saved = updateForm('sv-1', supplementCode, xmrAnswers([['Logic học', 2, 'Logic', '2 TC', 7]], [oldFile, newFile]), new Map([['local-9', new File(['%PDF'], 'ban-co-xac-nhan.pdf')]]))!;
    expect(saved.status).toBe('bsg');
    expect(saved.updatedAt).not.toBe(before.updatedAt);
    expect(saved.history.slice(0, -1)).toEqual(before.history);
    expect(saved.history.at(-1)).toMatchObject({ action: 'supplement', at: saved.updatedAt, actor: { id: 'sv-1' }, status: 'bsg' });
    expect(saved.answers['hoc-phan']).toEqual([['Logic học', 2, 'Logic', '2 TC', 7]]);
    const files = saved.answers['minh-chung'] as FileRef[];
    expect(files[0]).toEqual(oldFile);
    expect(files[1]).toMatchObject({ name: 'ban-co-xac-nhan.pdf' });
    expect(files[1]!.id).not.toBe('local-9');
    expect(getSavedFileIds(supplementCode)).toEqual(new Set(files.map((file) => file.id)));
  });

  test('gỡ tệp rồi lưu: tệp bị xóa hẳn, không còn trong kho tệp', () => {
    const xmr = getFormType('xmr')!;
    const files = [new File(['%PDF'], 'a.pdf'), new File(['%PDF'], 'b.pdf')];
    const answers = xmrAnswers([['Logic học', 2, 'Logic', '2 TC', 7]], files.map((file, i) => ({ id: `local-${i}`, name: file.name, sizeBytes: 4 })));
    const { code } = addForm('sv-1', 'sv-1', xmr, answers, new Map(files.map((file, i) => [`local-${i}`, file])));
    const [keptFile, removedFile] = getFilesOfForm(code);

    updateForm('sv-1', code, { ...answers, 'minh-chung': [keptFile!] }, new Map());
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
    const decidedForm = decideForm(underReviewCode(), 'bs', 'Thiếu bảng điểm', 'cb-1')!;
    expect(decidedForm.status).toBe('bs');
    expect(decidedForm.note).toBe('Thiếu bảng điểm');
    expect(decidedForm.history.at(-1)).toMatchObject({ action: 'requestSupplement', at: decidedForm.decidedAt, actor: { id: 'cb-1' }, status: 'bs', note: 'Thiếu bảng điểm' });
  });

  test('Từ chối: chuyển sang Từ chối và lưu lí do', () => {
    const decidedForm = decideForm(underReviewCode(), 'tc', 'Không đủ điều kiện', 'cb-1')!;
    expect(decidedForm.status).toBe('tc');
    expect(decidedForm.note).toBe('Không đủ điều kiện');
  });

  test('Duyệt: chuyển sang Đã duyệt và xóa lí do', () => {
    const decidedForm = decideForm(underReviewCode(), 'duyet', 'ghi chú cũ', 'cb-1')!;
    expect(decidedForm.status).toBe('duyet');
    expect(decidedForm.note).toBe('');
  });

  test('không đổi người xử lí và lần lưu gần nhất của đơn', () => {
    const code = underReviewCode();
    const before = getFormDetail(code, { id: 'cb-3', role: 'admin' })!;
    const decidedForm = decideForm(code, 'bs', '', 'cb-1')!;
    expect(decidedForm.handler).toEqual(before.handler);
    expect(decidedForm.updatedAt).toBe(before.updatedAt);
  });

  test('trả về null khi không có đơn', () => {
    expect(decideForm('XMR-0000-00000', 'duyet', '', 'cb-1')).toBeNull();
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
    const transferred = transferForm(code, newHandler.id, 'cb-1')!;
    expect(transferred.handler).toEqual(newHandler);
    expect(transferred.handler?.id).not.toBe(handler.id);
    expect(transferred.handlerSince).not.toBe(before.handlerSince);
    expect(transferred.receiver).toEqual(before.receiver);
    expect(transferred.status).toBe(before.status);
    expect(transferred.history.at(-1)).toMatchObject({ action: 'transfer', at: transferred.handlerSince, actor: { id: 'cb-1' }, toStaff: newHandler });
  });

  test('trả về null khi không có đơn hoặc không có cán bộ nhận', () => {
    const { code } = underReview();
    expect(transferForm('XMR-0000-00000', 'cb-2', 'cb-1')).toBeNull();
    expect(transferForm(code, 'khong-co', 'cb-1')).toBeNull();
    expect(getTransferTargets('XMR-0000-00000')).toBeNull();
  });
});

describe('tìm người dùng theo id', () => {
  test('thấy sinh viên đăng nhập thử (họ tên theo hồ sơ), cán bộ và sinh viên khác', () => {
    expect(findPerson('sv-1')).toMatchObject({ name: 'Nguyễn Minh Anh', email: 'minhanh.nguyen@hcmulaw.edu.vn' });
    expect(findPerson('cb-2')).toMatchObject({ name: 'Trần Quốc Việt' });
    expect(findPerson('sv-2')?.email).toBe('baongoc.tran@hcmulaw.edu.vn');
  });

  test('người chưa có hồ sơ riêng (sinh viên khác) chưa có SĐT, CCCD; MSSV lấy từ database trường', () => {
    expect(findPerson('sv-2')).toMatchObject({ phone: null, cccd: null });
    expect(findPerson('sv-2')?.students.map((student) => student.studentId)).toEqual(['2253801010012']);
    expect(findPerson('sv-5')?.students).toHaveLength(2);
    expect(findPerson('sv-7')?.students).toEqual([]);
  });

  test('có hồ sơ riêng thì lấy SĐT, CCCD, MSSV từ đó', () => {
    expect(findPerson('cb-1')).toMatchObject({ phone: '0912345678', cccd: '079188001122' });
    expect(findPerson('sv-1')?.students).toHaveLength(2);
  });

  test('trả về null khi không có người dùng', () => {
    expect(findPerson('khong-co')).toBeNull();
  });
});

describe('mọi đơn (Quản lí đơn)', () => {
  test('có đơn của mọi người nộp, kèm họ tên, email và lúc tiếp nhận', () => {
    const forms = getAllForms();
    expect(forms.length).toBeGreaterThan(getFormsOf('sv-1').length);
    expect(forms.some((form) => form.applicant.id === 'sv-1')).toBe(true);
    expect(forms.some((form) => form.applicant.id !== 'sv-1')).toBe(true);
    expect(forms[0]?.applicant.email).toContain('@');
    expect(forms.find((form) => form.status === 'nop')?.receivedAt).toBeNull();
  });

  test('người nộp chưa có SĐT, CCCD thì để null; có hồ sơ thì CCCD đã che', () => {
    const forms = getAllForms();
    const withoutProfile = forms.find((form) => form.applicant.id === 'sv-2');
    if (withoutProfile) expect(withoutProfile.applicant).toMatchObject({ phone: null, maskedCccd: null });
    saveProfile('sv-1', { name: 'Nguyễn Minh Anh', phone: '0987654321', cccd: '079200001234' });
    const ownForm = getAllForms().find((form) => form.applicant.id === 'sv-1');
    expect(ownForm?.applicant.maskedCccd).not.toBe('079200001234');
    expect(ownForm?.applicant.maskedCccd).toBeTruthy();
  });

  test('CCCD đầy đủ theo id người nộp; người chưa có CCCD không có mặt', () => {
    saveProfile('sv-1', { name: 'Nguyễn Minh Anh', phone: '0987654321', cccd: '079200001234' });
    const cccds = getApplicantCccds();
    expect(cccds['sv-1']).toBe('079200001234');
    expect(cccds['sv-2']).toBeUndefined();
  });
});

describe('nội dung tệp đính kèm', () => {
  const student = { id: 'sv-1', role: 'nguoiNopDon' } as const;
  const otherStudent = { id: 'sv-2', role: 'nguoiNopDon' } as const;
  const staff = { id: 'cb-1', role: 'nguoiXuLiDon' } as const;

  /** Tệp mẫu (không có nội dung thật) của đơn có sẵn XMR-2026-001-01437 của sv-1. */
  const sampleFile = () => {
    const detail = getFormDetail('XMR-2026-001-01437', student)!;
    return (detail.answers['minh-chung'] as FileRef[])[0]!;
  };

  test('tệp mẫu có sẵn của đơn thì trả về một PDF mẫu cùng tên, người nộp xem được', () => {
    const file = sampleFile();
    const content = getFileContent(file.id, student);
    expect(content?.name).toBe(file.name);
    expect(content?.type).toBe('application/pdf');
  });

  test('tệp người nộp vừa tải lên thì trả về đúng nội dung đã lưu', async () => {
    const newForm = addForm('sv-1', 'sv-1', getFormType('xmr')!, { 'minh-chung': [{ id: 'local-1', name: 'ghi-chu.png', sizeBytes: 3 }] }, new Map([['local-1', new File(['abc'], 'ghi-chu.png')]]));
    const savedFile = getFilesOfForm(newForm.code)[0]!;
    expect(await getFileContent(savedFile.id, student)?.text()).toBe('abc');
  });

  test('người nộp khác không xem được tệp của người khác; cán bộ xem được', () => {
    const file = sampleFile();
    expect(getFileContent(file.id, otherStudent)).toBeNull();
    expect(getFileContent(file.id, staff)).not.toBeNull();
  });

  test('không có tệp thì null', () => {
    expect(getFileContent('khong-co', staff)).toBeNull();
    expect(getFileContent('seed-XMR-0000-00000', staff)).toBeNull();
  });
});

describe('thống kê đơn (Quản lí đơn)', () => {
  test('tổng số đơn bằng số đơn của mọi người; số theo trạng thái cộng lại bằng tổng', () => {
    const stats = getFormStats();
    expect(stats.total).toBe(getAllForms().length);
    expect(Object.values(stats.byStatus).reduce((sum, count) => sum + count, 0)).toBe(stats.total);
    expect(Object.keys(stats.byStatus)).toHaveLength(6);
  });

  test('số theo loại đơn cộng lại bằng tổng, kể cả loại chưa có đơn (đếm 0) và ghi trạng thái loại đơn', () => {
    // Thêm một loại đơn chưa có đơn nào
    const { description, sections } = getFormType('xmr')!;
    createFormType({ prefix: 'MOI', name: 'Loại đơn mới', description, maxProcessingDays: null, status: 'draft', sections }, 'cb-1');

    const stats = getFormStats();
    expect(stats.byType.reduce((sum, type) => sum + type.count, 0)).toBe(stats.total);
    const xmr = stats.byType.find((type) => type.formTypeId === 'xmr');
    expect(xmr?.count).toBeGreaterThan(0);
    expect(xmr?.formTypeStatus).toBe('open');
    expect(stats.byType.some((type) => type.count === 0)).toBe(true);
  });

  test('nhiều đơn nhất đứng trước', () => {
    const counts = getFormStats().byType.map((type) => type.count);
    expect(counts).toEqual([...counts].sort((a, b) => b - a));
  });
});

describe('tài khoản', () => {
  const admin = { id: 'cb-3' };
  const newStaff = { name: 'Hồ Thị Lan', email: 'lan.ho.pdt@hcmulaw.edu.vn', role: 'nguoiXuLiDon', cccd: '', phone: '' } as const;

  test('bảng tài khoản có đủ 14 tài khoản mẫu, CCCD che; Hiện CCCD trả số đầy đủ', () => {
    const list = getAccounts();
    expect(list).toHaveLength(14);
    expect(list.find((account) => account.id === 'cb-1')).toMatchObject({ role: 'nguoiXuLiDon', maskedCccd: '079•••••1122' });
    expect(getAccountCccds()).toEqual({ 'cb-1': '079188001122', 'cb-3': '079190003344' });
  });

  test('tạo tài khoản: chưa bổ sung thông tin; email hoặc CCCD đã có tài khoản thì 409', () => {
    const created = createAccount(newStaff);
    expect(created.ok && created.account).toMatchObject({ name: 'Hồ Thị Lan', role: 'nguoiXuLiDon', phone: null, maskedCccd: null });
    expect(created.ok && getProfile(created.account.id).completed).toBe(false);
    expect(createAccount({ ...newStaff, email: 'thuha.pham.pdt@hcmulaw.edu.vn' })).toMatchObject({ ok: false, status: 409 });
    expect(createAccount({ ...newStaff, email: 'khac@hcmulaw.edu.vn', cccd: '079188001122' })).toMatchObject({ ok: false, status: 409 });
  });

  test('sửa tài khoản: đổi tên hiện ở đơn đã xử lí; không tự đổi vai trò; CCCD trùng 409; không có tài khoản 404', () => {
    const updated = updateAccount('cb-2', { name: 'Trần Quốc Việt Anh', cccd: '', phone: '0901234567', role: 'nguoiXuLiDon' }, admin);
    expect(updated.ok).toBe(true);
    expect(getFormsHandledBy('cb-2').some((form) => form.handler?.name === 'Trần Quốc Việt Anh' || form.receiver?.name === 'Trần Quốc Việt Anh')).toBe(true);
    expect(updateAccount('cb-3', { name: 'Lê Ngọc Diệp', cccd: '', phone: '', role: 'nguoiNopDon' }, admin)).toMatchObject({ ok: false, status: 422 });
    expect(updateAccount('sv-2', { name: 'Trần Thị Bảo Ngọc', cccd: '079188001122', phone: '', role: 'nguoiNopDon' }, admin)).toMatchObject({ ok: false, status: 409 });
    expect(updateAccount('khong-co', { name: 'Ai Đó', cccd: '', phone: '', role: 'nguoiNopDon' }, admin)).toMatchObject({ ok: false, status: 404 });
  });

  test('đổi cán bộ sang Người nộp đơn: không còn trong danh sách Chuyển giao, đơn đang phụ trách giữ nguyên', () => {
    const handledBefore = getFormsHandledBy('cb-2').length;
    updateAccount('cb-2', { name: 'Trần Quốc Việt', cccd: '', phone: '', role: 'nguoiNopDon' }, admin);
    const code = getAllForms().find((form) => form.status === 'xet')!.code;
    expect(getTransferTargets(code)!.map((staff) => staff.id)).not.toContain('cb-2');
    expect(transferForm(code, 'cb-2', 'cb-1')).toBeNull();
    expect(getFormsHandledBy('cb-2')).toHaveLength(handledBefore);
  });

  test('phiên lấy vai trò theo tài khoản; đăng nhập thử dùng tài khoản khác khi tài khoản mẫu đã đổi vai trò', () => {
    updateAccount('cb-1', { name: 'Phạm Thu Hà', cccd: '079188001122', phone: '0912345678', role: 'nguoiNopDon' }, admin);
    expect(toSession('cb-1').role).toBe('nguoiNopDon');
    expect(demoAccountFor('nguoiXuLiDon')).toBe('cb-2');
    updateAccount('cb-2', { name: 'Trần Quốc Việt', cccd: '', phone: '', role: 'nguoiNopDon' }, admin);
    expect(demoAccountFor('nguoiXuLiDon')).toBeNull();
  });
});

describe('ngày nghỉ', () => {
  beforeEach(() => resetMockDb());

  test('có sẵn ngày nghỉ mẫu, xếp theo lịch; thêm, sửa, xóa; trùng ngày thì báo tên ngày nghỉ bị trùng', () => {
    const seeded = getHolidays();
    expect(seeded.length).toBeGreaterThan(0);
    expect(seeded.map((holiday) => holiday.startDate)).toEqual(seeded.map((holiday) => holiday.startDate).sort());

    const added = saveHoliday({ name: 'Nghỉ thử', startDate: '2026-12-24', endDate: '2026-12-25' });
    expect(added).toMatchObject({ name: 'Nghỉ thử' });
    if (typeof added === 'string' || 'overlaps' in added) throw new Error('phải thêm được');
    expect(saveHoliday({ name: 'Trùng', startDate: '2026-12-25', endDate: '2026-12-25' })).toEqual({ overlaps: 'Nghỉ thử' });
    expect(saveHoliday({ name: 'Nghỉ thử', startDate: '2026-12-25', endDate: '2026-12-26' }, added.id)).toMatchObject({ endDate: '2026-12-26' });
    expect(saveHoliday({ name: 'X', startDate: '2026-12-28', endDate: '2026-12-28' }, 'khong-co')).toBe('notFound');

    expect(deleteHoliday(added.id)).toMatchObject({ id: added.id });
    expect(deleteHoliday(added.id)).toBeNull();
    expect(getHolidays()).toHaveLength(seeded.length);
  });
});
