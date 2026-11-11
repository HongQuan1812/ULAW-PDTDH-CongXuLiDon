import { describe, expect, it } from 'vitest';
import { FormSectionSchema, type FormSection } from '../aux-schema/form-types--sections';
import { FORM_TYPE_DRAFT_MESSAGES, FORM_TYPE_ISSUE_TARGET, issueMessages, validateFormTypeDraft, type FormTypeDraftInput } from './form-types';

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
        { id: 'info', type: 'info', label: '', required: false },
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

  it('loại đơn đang mở phải có câu hỏi; nháp thì không cần', () => {
    const onlyInfo = [FormSectionSchema.parse({ id: 's1', title: 'A', questions: [{ id: 'i', type: 'info', label: '' }] })];
    expect(validateFormTypeDraft({ ...validDraft(), sections: onlyInfo }, [])).toEqual([
      { target: null, message: FORM_TYPE_DRAFT_MESSAGES.openWithoutQuestion },
    ]);
    expect(validateFormTypeDraft({ ...validDraft(), status: 'draft', sections: onlyInfo }, [])).toEqual([]);
  });
});

