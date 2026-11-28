import { describe, expect, it } from 'vitest';
import { FormSectionSchema, type FormSection } from '../aux-schema/form-types--sections';
import { MAX_PROCESSING_DAYS_LIMIT } from '../aux-schema/forms--deadlines';
import { EMPTY_RICH_TEXT_DOC } from '../aux-schema/rich-text';
import {
  EMPTY_FORM_TYPE_TIME_SETTINGS,
  FORM_TYPE_TIME_MESSAGES,
  SaveFormTypeTimeSettingsRequestSchema,
  type SaveFormTypeTimeSettingsRequest,
} from '../api-contract/form-types';
import {
  FORM_TYPE_DRAFT_MESSAGES,
  FORM_TYPE_ISSUE_TARGET,
  FORM_TYPE_TIME_ISSUE_TARGET,
  issueMessages,
  validateFormTypeDraft,
  validateFormTypeTimeSettings,
  type FormTypeDraftInput,
} from './form-types';

/** Bản soạn hợp lệ: một phần, một câu hỏi ngắn. */
const validDraft = (): FormTypeDraftInput => ({
  name: 'Xin bảo lưu',
  prefix: 'BL',
  status: 'open',
  sections: [FormSectionSchema.parse({ id: 's1', title: 'Lí do', questions: [{ id: 'q1', type: 'text', label: 'Lí do bảo lưu' }] })],
});

describe('validateFormTypeDraft', () => {
  it('bản soạn hợp lệ thì không có lỗi', () => {
    expect(validateFormTypeDraft(validDraft(), ['XMM'])).toEqual([]);
  });

  it('báo tên trống, mã đơn sai dạng hoặc trùng', () => {
    const issues = validateFormTypeDraft({ ...validDraft(), name: ' ', prefix: 'B' }, []);
    expect(issues.map((issue) => issue.target)).toEqual([FORM_TYPE_ISSUE_TARGET.name, FORM_TYPE_ISSUE_TARGET.prefix]);
    expect(validateFormTypeDraft({ ...validDraft(), prefix: 'XMM' }, ['XMM'])[0]!.message).toBe(FORM_TYPE_DRAFT_MESSAGES.prefixTaken('XMM'));
  });

  it('báo tiêu đề phần, nội dung câu hỏi, lựa chọn, cột, định dạng tệp; khối thông báo không cần nội dung', () => {
    // Bản đang soạn có thể chưa qua được FormSectionSchema (lựa chọn, tên cột trống…), nên dựng thẳng, không parse
    const section = {
      id: 's1',
      title: '',
      main: false,
      questions: [
        { id: 'info', type: 'info', content: EMPTY_RICH_TEXT_DOC },
        { id: 'q1', type: 'radio', label: '', required: false, options: ['A', ' ', ''] },
        { id: 'q2', type: 'table', label: 'Bảng', required: false, rowName: 'dòng', columns: [{ label: '', type: 'text' }] },
        { id: 'q3', type: 'file', label: 'Tệp', required: false, accept: [], maxMB: 10 },
      ],
    } as FormSection;
    const issues = validateFormTypeDraft({ ...validDraft(), sections: [section] }, []);
    expect(issues.map((issue) => issue.target)).toEqual([
      FORM_TYPE_ISSUE_TARGET.sectionTitle('s1'),
      FORM_TYPE_ISSUE_TARGET.questionLabel('q1'),
      FORM_TYPE_ISSUE_TARGET.option('q1', 1),
      FORM_TYPE_ISSUE_TARGET.option('q1', 2),
      FORM_TYPE_ISSUE_TARGET.column('q2', 0),
      FORM_TYPE_ISSUE_TARGET.fileFormats('q3'),
    ]);
    expect(issueMessages(issues)).toContain('Phần 1, câu 2: lựa chọn không được để trống.');
    expect(issueMessages(issues).filter((message) => message.includes('lựa chọn'))).toHaveLength(1);
  });

  it('báo cột kiểu Chọn chưa có lựa chọn hoặc có lựa chọn trống', () => {
    const section = {
      id: 's1',
      title: 'A',
      main: false,
      questions: [
        {
          id: 'q1',
          type: 'table',
          label: 'Bảng',
          required: false,
          rowName: 'dòng',
          columns: [
            { label: 'Học kì', type: 'select', options: ['HK1', ' '] },
            { label: 'Năm học', type: 'select', options: [] },
          ],
        },
      ],
    } as FormSection;
    const issues = validateFormTypeDraft({ ...validDraft(), sections: [section] }, []);
    expect(issues.map((issue) => issue.target)).toEqual([
      FORM_TYPE_ISSUE_TARGET.columnOption('q1', 0, 1),
      FORM_TYPE_ISSUE_TARGET.columnOption('q1', 1, null),
    ]);
    expect(issueMessages(issues)).toEqual([FORM_TYPE_DRAFT_MESSAGES.emptyColumnOption(1, 1)]);
  });

  it('báo mã dùng trong file Word sai dạng, trùng mã có sẵn, trùng nhau (kể cả mã cột)', () => {
    const section = FormSectionSchema.parse({
      id: 's1',
      title: 'A',
      questions: [
        { id: 'q1', type: 'text', label: 'Họ tên', tag: 'ho_ten' },
        { id: 'q2', type: 'text', label: 'Bảng môn học' },
        { id: 'q3', type: 'table', label: 'Bảng', rowName: 'dòng', columns: [{ label: 'Môn học', type: 'text' }] },
        { id: 'q4', type: 'text', label: 'Số', tag: '1so' },
      ],
    });
    const issues = validateFormTypeDraft({ ...validDraft(), sections: [section] }, []);
    expect(issues).toEqual([
      { target: FORM_TYPE_ISSUE_TARGET.questionTag('q1'), message: FORM_TYPE_DRAFT_MESSAGES.tagReserved(1, 1, 'ho_ten') },
      { target: FORM_TYPE_ISSUE_TARGET.questionTag('q3'), message: FORM_TYPE_DRAFT_MESSAGES.tagTaken(1, 3, 'bang_mon_hoc', 'phần 1, câu 2', true) },
      { target: FORM_TYPE_ISSUE_TARGET.questionTag('q4'), message: FORM_TYPE_DRAFT_MESSAGES.tagFormat(1, 4) },
    ]);
  });

  it('hai bảng có cột cùng tên (IELTS, TOEIC cùng có "Số hiệu"): mã cột gồm mã bảng nên không trùng', () => {
    const section = FormSectionSchema.parse({
      id: 's1',
      title: 'A',
      questions: [
        { id: 'q1', type: 'table', label: 'Chứng chỉ IELTS', tag: 'ielts', rowName: 'chứng chỉ', columns: [{ label: 'Số hiệu', type: 'text' }, { label: 'Ngày thi', type: 'text' }] },
        { id: 'q2', type: 'table', label: 'Chứng chỉ TOEIC', tag: 'toeic', rowName: 'chứng chỉ', columns: [{ label: 'Số hiệu', type: 'text' }, { label: 'Ngày thi', type: 'text' }] },
      ],
    });
    expect(validateFormTypeDraft({ ...validDraft(), sections: [section] }, [])).toEqual([]);
  });

  it('cột tên "STT" trùng mã số thứ tự dòng {<bảng>_stt} của chính bảng đó: báo trùng mã có sẵn', () => {
    const section = FormSectionSchema.parse({
      id: 's1',
      title: 'A',
      questions: [{ id: 'q1', type: 'table', label: 'IELTS', tag: 'ielts', rowName: 'chứng chỉ', columns: [{ label: 'STT', type: 'text' }] }],
    });
    expect(validateFormTypeDraft({ ...validDraft(), sections: [section] }, [])).toEqual([
      { target: FORM_TYPE_ISSUE_TARGET.questionTag('q1'), message: FORM_TYPE_DRAFT_MESSAGES.tagReserved(1, 1, 'ielts_stt') },
    ]);
  });

  it('loại đơn đang mở phải có câu hỏi; nháp thì không cần', () => {
    const onlyInfo = [FormSectionSchema.parse({ id: 's1', title: 'A', questions: [{ id: 'i', type: 'info', content: EMPTY_RICH_TEXT_DOC }] })];
    expect(validateFormTypeDraft({ ...validDraft(), sections: onlyInfo }, [])).toEqual([
      { target: null, message: FORM_TYPE_DRAFT_MESSAGES.openWithoutQuestion },
    ]);
    expect(validateFormTypeDraft({ ...validDraft(), status: 'draft', sections: onlyInfo }, [])).toEqual([]);
  });
});


describe('validateFormTypeTimeSettings', () => {
  const noSchedule = { maxProcessingDays: null, autoOpen: null, autoClose: null };
  /** Lúc lưu: 10:00 28/11/2026 */
  const now = '2026-11-28T10:00';
  const check = (settings: SaveFormTypeTimeSettingsRequest, previous = EMPTY_FORM_TYPE_TIME_SETTINGS) =>
    validateFormTypeTimeSettings(settings, [1, 2], previous, now);

  it('để trống hết, hoặc hẹn đúng luật thì không có lỗi', () => {
    expect(check(noSchedule)).toEqual([]);
    expect(check({ maxProcessingDays: 5, autoOpen: { at: '2026-12-01T08:00', version: 2 }, autoClose: { at: '2026-12-05T17:00' } })).toEqual([]);
    // Chỉ hẹn đóng, không hẹn mở
    expect(check({ ...noSchedule, autoClose: { at: '2026-12-05T17:00' } })).toEqual([]);
  });

  it('thời gian xử lí: để trống hoặc số nguyên 1–365', () => {
    expect(check({ ...noSchedule, maxProcessingDays: 1 })).toEqual([]);
    expect(check({ ...noSchedule, maxProcessingDays: MAX_PROCESSING_DAYS_LIMIT })).toEqual([]);
    for (const maxProcessingDays of [0, -3, 1.5, MAX_PROCESSING_DAYS_LIMIT + 1]) {
      expect(check({ ...noSchedule, maxProcessingDays }).map((issue) => issue.target)).toEqual([FORM_TYPE_TIME_ISSUE_TARGET.maxProcessingDays]);
    }
  });

  it('phiên bản tự mở không có', () => {
    expect(check({ ...noSchedule, autoOpen: { at: '2026-12-01T08:00', version: 3 } })).toEqual([
      { target: FORM_TYPE_TIME_ISSUE_TARGET.autoOpenVersion, message: FORM_TYPE_TIME_MESSAGES.versionMissing(3) },
    ]);
  });

  it('giờ đóng phải sau giờ mở (trùng phút cũng sai)', () => {
    for (const closeAt of ['2026-12-01T08:00', '2026-11-30T17:00']) {
      expect(check({ ...noSchedule, autoOpen: { at: '2026-12-01T08:00', version: 1 }, autoClose: { at: closeAt } })).toEqual([
        { target: FORM_TYPE_TIME_ISSUE_TARGET.autoCloseAt, message: FORM_TYPE_TIME_MESSAGES.closeBeforeOpen },
      ]);
    }
  });

  it('giờ hẹn mới đã qua (kể cả đúng phút này) thì chặn', () => {
    for (const at of ['2026-11-28T09:00', '2026-11-28T10:00']) {
      expect(check({ ...noSchedule, autoClose: { at } })).toEqual([{ target: FORM_TYPE_TIME_ISSUE_TARGET.autoCloseAt, message: FORM_TYPE_TIME_MESSAGES.inThePast }]);
      expect(check({ ...noSchedule, autoOpen: { at, version: 1 } })).toEqual([{ target: FORM_TYPE_TIME_ISSUE_TARGET.autoOpenAt, message: FORM_TYPE_TIME_MESSAGES.inThePast }]);
    }
  });

  it('giờ đã chạy giữ nguyên thì lưu được (vd chỉ sửa thời gian xử lí)', () => {
    const ran = {
      maxProcessingDays: 5,
      autoOpen: { at: '2026-11-20T08:00', version: 1, done: true },
      autoClose: { at: '2026-11-25T17:00', done: true },
    };
    const request = { maxProcessingDays: 7, autoOpen: { at: '2026-11-20T08:00', version: 1 }, autoClose: { at: '2026-11-25T17:00' } };
    expect(check(request, ran)).toEqual([]);
    // Đổi phiên bản tự mở mà giữ giờ: dấu đã chạy vẫn giữ, không chặn
    expect(check({ ...request, autoOpen: { at: '2026-11-20T08:00', version: 2 } }, ran)).toEqual([]);
  });
});

describe('SaveFormTypeTimeSettingsRequestSchema', () => {
  it('giờ hẹn phải là phút có thật', () => {
    const request = (at: string) => ({ maxProcessingDays: null, autoOpen: null, autoClose: { at } });
    expect(SaveFormTypeTimeSettingsRequestSchema.safeParse(request('2026-12-05T17:00')).success).toBe(true);
    for (const at of ['2026-02-30T08:00', '2026-12-05T24:00', '2026-12-05 17:00', '2026-12-05T17:00:00']) {
      expect(SaveFormTypeTimeSettingsRequestSchema.safeParse(request(at)).success).toBe(false);
    }
  });
});
