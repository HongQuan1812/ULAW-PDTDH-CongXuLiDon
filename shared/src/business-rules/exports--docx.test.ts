import PizZip from 'pizzip';
import { describe, expect, test } from 'vitest';
import { FormSectionSchema } from '../aux-schema/form-types--sections';
import { checkDocxTemplate, createFormStarterDocx, openDocx, renderDocxTemplate } from './exports--docx';

/** Loại đơn thử: câu chữ có dấu đặc biệt trong tên, một bảng, một câu chọn nhiều. */
const sections = [
  FormSectionSchema.parse({
    id: 's1',
    title: 'A',
    questions: [
      { id: 'q1', type: 'text', label: 'Lý do <ngắn> & rõ' },
      {
        id: 'q2',
        type: 'table',
        label: 'Môn',
        tag: 'mon',
        rowName: 'môn',
        columns: [
          { label: 'Tên môn', type: 'text' },
          { label: 'Số tín chỉ', type: 'number', sum: true },
        ],
      },
    ],
  }),
];

describe('createFormStarterDocx', () => {
  test('dựng được file .docx mở lại được', () => {
    // Act
    const starter = createFormStarterDocx(sections);

    // Assert
    expect(openDocx(starter)).not.toBeNull();
  });

  test('qua bộ kiểm tra mẫu: mã nào cũng có thật, mã cột nằm trong vòng lặp, không lỗi cú pháp', () => {
    // Act
    const check = checkDocxTemplate(createFormStarterDocx(sections), sections);

    // Assert
    expect(check).toMatchObject({ unknown: [], outside: [], error: '' });
    expect(check.found).toEqual(expect.arrayContaining(['ho_ten', 'mssv', 'ma_don', 'loai_don', 'ly_do_ngan_ro', 'mon', 'ten_mon', 'so_tin_chi']));
  });

  test('điền thử: bảng nhân lên mỗi môn một dòng, chữ có dấu & < không làm hỏng file', () => {
    // Arrange
    const starter = createFormStarterDocx(sections);
    const exportData = {
      loai_don: 'Xét miễn môn',
      ly_do_ngan_ro: 'Đã học',
      mon: [
        { stt: 1, ten_mon: 'Luật Dân sự', so_tin_chi: 3 },
        { stt: 2, ten_mon: 'Luật Hình sự', so_tin_chi: 2 },
      ],
    };

    // Act
    const filled = renderDocxTemplate(starter, exportData);
    const text = new PizZip(filled).file('word/document.xml')!.asText().replace(/<[^>]+>/g, '');

    // Assert
    expect(text).toContain('Luật Dân sự');
    expect(text).toContain('Luật Hình sự');
    expect(text).toContain('Đã học');
  });
});
