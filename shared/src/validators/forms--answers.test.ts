import { describe, expect, it } from 'vitest';
import { QuestionSchema, type AnswerableQuestion } from '../aux-schema/form-types--question-types';
import { FormSectionSchema } from '../aux-schema/form-types--sections';
import { emptyAnswer } from '../aux-schema/forms--answers';
import { EMPTY_RICH_TEXT_DOC, plainTextToRichText } from '../aux-schema/rich-text';
import { ANSWER_MESSAGES, formatFileSize, validateAnswer, validateAnswers, validateFile, validateSentFiles } from './forms--answers';

/* Cấu trúc Xét miễn môn như TYPES.xmm trong artifact/js/config.js. */
const XMM_SECTIONS = [
  FormSectionSchema.parse({
    id: 's-mon',
    title: 'Đăng ký miễn môn',
    main: true,
    questions: [
      {
        id: 'mon',
        tag: 'mon',
        type: 'table',
        label: 'Các môn xin miễn',
        required: true,
        rowName: 'môn',
        columns: [
          { label: 'Môn học của trường', type: 'text' },
          { label: 'Số tín chỉ', type: 'number', sum: true, sumLabel: 'tín chỉ' },
          { label: 'Môn học tương đương', type: 'text' },
          { label: 'Cơ sở đào tạo', type: 'text' },
        ],
      },
    ],
  }),
  FormSectionSchema.parse({
    id: 's-files',
    title: 'Bảng điểm minh chứng',
    questions: [
      { id: 'files', type: 'file', label: 'Tệp bảng điểm', required: true, accept: ['pdf', 'jpg', 'png'], maxMB: 10 },
      { id: 'note', type: 'info', content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Bảng điểm phải có xác nhận.' }] }] } },
    ],
  }),
];

/**
 * Tạo câu hỏi (đã qua schema) để thử.
 * @param raw  câu hỏi dạng JSON
 * @returns    câu hỏi cần trả lời
 */
const questionOf = (raw: object) => QuestionSchema.parse(raw) as AnswerableQuestion;

describe('cấu trúc loại đơn', () => {
  it('đọc được cấu trúc Xét miễn môn; required mặc định false, main mặc định false', () => {
    expect(XMM_SECTIONS[0]!.main).toBe(true);
    expect(XMM_SECTIONS[1]!.main).toBe(false);
    expect(questionOf({ id: 'a', type: 'text', label: 'Lí do' }).required).toBe(false);
  });

  it('báo lỗi khi câu hỏi thiếu thuộc tính của loại đó', () => {
    expect(QuestionSchema.safeParse({ id: 'a', type: 'select', label: 'Học kỳ', options: [] }).success).toBe(false);
    expect(QuestionSchema.safeParse({ id: 'a', type: 'table', label: 'Môn', rowName: 'môn', columns: [] }).success).toBe(false);
    expect(QuestionSchema.safeParse({ id: 'a', type: 'text', label: 'Lí do', tag: 'Lí do' }).success).toBe(false);
  });
});

describe('validateAnswer', () => {
  it('đoạn văn: bắt buộc thì phải có chữ (văn bản có định dạng hoặc chuỗi cũ)', () => {
    const para = questionOf({ id: 'p', type: 'para', label: 'Lí do', required: true });
    expect(validateAnswer(para, EMPTY_RICH_TEXT_DOC)).toBe(ANSWER_MESSAGES.required);
    expect(validateAnswer(para, plainTextToRichText('  '))).toBe(ANSWER_MESSAGES.required);
    expect(validateAnswer(para, plainTextToRichText('Học lại'))).toBe('');
    expect(validateAnswer(para, 'Chuỗi cũ')).toBe('');
    expect(validateAnswer(para, '')).toBe(ANSWER_MESSAGES.required);
  });

  it('trả lời ngắn, số, ngày', () => {
    const text = questionOf({ id: 't', type: 'text', label: 'Lí do', required: true });
    expect(validateAnswer(text, '   ')).toBe(ANSWER_MESSAGES.required);
    expect(validateAnswer(text, 'Học lại')).toBe('');

    const number = questionOf({ id: 'n', type: 'number', label: 'Số tín chỉ' });
    expect(validateAnswer(number, null)).toBe('');
    expect(validateAnswer(number, 'ba')).toBe(ANSWER_MESSAGES.notNumber);

    const date = questionOf({ id: 'd', type: 'date', label: 'Ngày', required: true });
    expect(validateAnswer(date, '')).toBe(ANSWER_MESSAGES.required);
    expect(validateAnswer(date, '30/10/2026')).toBe(ANSWER_MESSAGES.invalidDate);
    expect(validateAnswer(date, '2026-10-30')).toBe('');
  });

  it('câu chọn: phải chọn khi bắt buộc, và chỉ nhận lựa chọn có sẵn', () => {
    const radio = questionOf({ id: 'r', type: 'radio', label: 'Học kỳ', required: true, options: ['HK1', 'HK2'] });
    expect(validateAnswer(radio, '')).toBe(ANSWER_MESSAGES.pickOne);
    expect(validateAnswer(radio, 'HK3')).toBe(ANSWER_MESSAGES.invalidChoice);
    const check = questionOf({ id: 'c', type: 'check', label: 'Môn', required: true, options: ['A', 'B'] });
    expect(validateAnswer(check, [])).toBe(ANSWER_MESSAGES.pickAtLeastOne);
    expect(validateAnswer(check, ['A', 'B'])).toBe('');
  });

  it('bảng: cần ít nhất một dòng, đủ ô, cột số là số không âm', () => {
    const table = XMM_SECTIONS[0]!.questions[0] as AnswerableQuestion;
    expect(validateAnswer(table, [])).toBe('Thêm ít nhất một môn.');
    expect(validateAnswer(table, [['Triết học', 3, '', 'ĐH KHXH&NV']])).toBe('Điền đủ 4 cột cho các ô được tô đỏ.');
    expect(validateAnswer(table, [['Triết học', -1, 'Triết học', 'ĐH KHXH&NV']])).toBe(
      'Cột “Số tín chỉ” chỉ nhận số không âm.',
    );
    expect(validateAnswer(table, [['Triết học', 3, 'Triết học', 'ĐH KHXH&NV']])).toBe('');
  });

  it('câu trả lời trống theo loại câu hỏi', () => {
    expect(emptyAnswer(questionOf({ id: 'n', type: 'number', label: 'Số' }))).toBeNull();
    expect(emptyAnswer(XMM_SECTIONS[0]!.questions[0] as AnswerableQuestion)).toEqual([]);
    expect(emptyAnswer(questionOf({ id: 't', type: 'para', label: 'Lí do' }))).toEqual(EMPTY_RICH_TEXT_DOC);
  });
});

describe('validateAnswers', () => {
  it('báo lỗi từng câu và câu báo chung từng phần; bỏ qua khối thông báo', () => {
    const result = validateAnswers(XMM_SECTIONS, { mon: [['Triết học', 3, 'Triết học', 'ĐH KHXH&NV']], files: [] });
    expect(result.questionErrors).toEqual({ files: ANSWER_MESSAGES.fileRequired });
    expect(result.sectionErrors).toEqual(['Kiểm tra lại phần “Bảng điểm minh chứng”.']);
    expect(result.invalidSectionTitles).toEqual(['Bảng điểm minh chứng']);
    expect(ANSWER_MESSAGES.sectionsToCheck(['Bảng điểm minh chứng'])).toBe('Kiểm tra lại phần “Bảng điểm minh chứng”.');
    expect(ANSWER_MESSAGES.sectionsToCheck(['Đăng ký miễn môn', 'Bảng điểm minh chứng'])).toBe(
      'Kiểm tra lại các phần “Đăng ký miễn môn”, “Bảng điểm minh chứng”.',
    );
  });

  it('đủ câu trả lời thì không có lỗi', () => {
    const result = validateAnswers(XMM_SECTIONS, {
      mon: [['Triết học', 3, 'Triết học', 'ĐH KHXH&NV']],
      files: [{ id: 'file-1', name: 'bang-diem.pdf', sizeBytes: 120_000 }],
    });
    expect(result).toEqual({ questionErrors: {}, sectionErrors: [], invalidSectionTitles: [] });
  });
});

describe('validateFile', () => {
  const fileQuestion = questionOf({ id: 'f', type: 'file', label: 'Tệp', accept: ['pdf', 'jpg'], maxMB: 2 }) as Extract<
    AnswerableQuestion,
    { type: 'file' }
  >;

  it('nhận đúng định dạng (jpg thì nhận cả jpeg), không phân biệt hoa thường', () => {
    expect(validateFile(fileQuestion, 'bang-diem.PDF', 1000)).toBe('');
    expect(validateFile(fileQuestion, 'anh.jpeg', 1000)).toBe('');
  });

  it('báo sai định dạng và quá dung lượng, kèm tên tệp', () => {
    expect(validateFile(fileQuestion, 'ghi-chu.docx', 1000)).toBe(ANSWER_MESSAGES.fileType('ghi-chu.docx', 'PDF · JPG'));
    expect(validateFile(fileQuestion, 'khong-duoi', 1000)).toBe(ANSWER_MESSAGES.fileType('khong-duoi', 'PDF · JPG'));
    expect(validateFile(fileQuestion, 'lon.pdf', 3 * 1024 * 1024)).toBe('lon.pdf: 3.0 MB, vượt quá 2 MB.');
  });

  it('ghi dung lượng theo KB / MB', () => {
    expect(formatFileSize(500)).toBe('1 KB');
    expect(formatFileSize(820 * 1024)).toBe('820 KB');
    expect(formatFileSize(1.5 * 1024 * 1024)).toBe('1.5 MB');
  });
});

describe('validateSentFiles', () => {
  const answers = {
    mon: [['Triết học', 3, 'Triết học', 'ĐH KHXH&NV']],
    files: [{ id: 'local-1', name: 'bang-diem.pdf', sizeBytes: 4 }],
  };

  it('mỗi tệp trong câu trả lời có nội dung gửi kèm, đúng định dạng: hợp lệ', () => {
    expect(validateSentFiles(XMM_SECTIONS, answers, new Map([['local-1', { name: 'bang-diem.pdf', sizeBytes: 4 }]]))).toBe('');
  });

  it('thiếu tệp, tệp sai định dạng, hoặc thừa tệp: báo lỗi', () => {
    expect(validateSentFiles(XMM_SECTIONS, answers, new Map())).toBe(ANSWER_MESSAGES.fileMissing('bang-diem.pdf'));
    expect(validateSentFiles(XMM_SECTIONS, answers, new Map([['local-1', { name: 'virus.exe', sizeBytes: 4 }]]))).toContain(
      'virus.exe: định dạng không hỗ trợ',
    );
    const extraFile = new Map([
      ['local-1', { name: 'bang-diem.pdf', sizeBytes: 4 }],
      ['local-2', { name: 'them.pdf', sizeBytes: 4 }],
    ]);
    expect(validateSentFiles(XMM_SECTIONS, answers, extraFile)).toBe(ANSWER_MESSAGES.unexpectedFiles);
  });

  it('sửa đơn: tệp đã lưu của đơn giữ lại không cần gửi kèm; tệp lạ hoặc lặp lại thì báo lỗi', () => {
    const editedAnswers = {
      mon: answers.mon,
      files: [
        { id: 'file-1', name: 'cu.pdf', sizeBytes: 9 },
        { id: 'local-1', name: 'moi.pdf', sizeBytes: 4 },
      ],
    };
    const newFile = new Map([['local-1', { name: 'moi.pdf', sizeBytes: 4 }]]);
    expect(validateSentFiles(XMM_SECTIONS, editedAnswers, newFile, new Set(['file-1']))).toBe('');
    expect(validateSentFiles(XMM_SECTIONS, editedAnswers, newFile, new Set(['file-khac']))).toBe(ANSWER_MESSAGES.fileMissing('cu.pdf'));
    const repeated = { ...editedAnswers, files: [editedAnswers.files[0]!, editedAnswers.files[0]!] };
    expect(validateSentFiles(XMM_SECTIONS, repeated, new Map(), new Set(['file-1']))).toBe(ANSWER_MESSAGES.fileMissing('cu.pdf'));
  });
});
