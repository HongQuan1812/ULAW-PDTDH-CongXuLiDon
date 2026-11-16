import PizZip from 'pizzip';
import { describe, expect, test } from 'vitest';
import { FormSectionSchema } from '../aux-schema/form-types--sections';
import { COMMON_EXPORT_TAG_GROUPS } from './exports--tags';
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

  test('qua bộ kiểm tra mẫu: mã nào cũng có thật, không có {#…} {/…}, không lỗi cú pháp', () => {
    // Act
    const check = checkDocxTemplate(createFormStarterDocx(sections), sections);

    // Assert
    expect(check).toMatchObject({ unknown: [], error: '' });
    expect(check.found).toEqual(expect.arrayContaining(['ho_ten', 'mssv', 'ma_don', 'loai_don', 'ly_do_ngan_ro', 'mon_stt', 'mon_ten_mon', 'mon_so_tin_chi']));
  });

  test('có đủ mọi mã chung của Bảng mã (người nộp đơn, thông tin đơn)', () => {
    // Arrange
    const commonTags = COMMON_EXPORT_TAG_GROUPS.flatMap((group) => group.tags.map(({ tag }) => tag));

    // Act
    const { found } = checkDocxTemplate(createFormStarterDocx(sections), sections);

    // Assert
    expect(commonTags.filter((tag) => !found.includes(tag))).toEqual([]);
  });

  test('mỗi dòng "tên: {mã}" là một gạch đầu dòng thật (có numbering.xml), tiêu đề mục thì không; bảng thụt vào dưới câu hỏi của nó', () => {
    // Act
    const zip = new PizZip(createFormStarterDocx(sections));
    const documentXml = zip.file('word/document.xml')!.asText();

    // Assert: 10 + 13 mã chung, 1 câu hỏi chữ và 1 câu hỏi bảng (bảng thụt vào dưới gạch đầu dòng của nó)
    expect(documentXml.match(/<w:numPr>/g)).toHaveLength(10 + 13 + 1 + 1);
    expect(documentXml).toContain('<w:jc w:val="right"/>');
    expect(zip.file('word/numbering.xml')).not.toBeNull();
    expect(zip.file('word/_rels/document.xml.rels')!.asText()).toContain('numbering.xml');
    expect(zip.file('[Content_Types].xml')!.asText()).toContain('/word/numbering.xml');
  });

  test('điền thử: bảng nhân lên mỗi môn một dòng, chữ có dấu & < không làm hỏng file', () => {
    // Arrange
    const starter = createFormStarterDocx(sections);
    const exportData = {
      loai_don: 'Xét miễn môn',
      ly_do_ngan_ro: 'Đã học',
      mon: [
        { mon_stt: 1, mon_ten_mon: 'Luật Dân sự', mon_so_tin_chi: 3 },
        { mon_stt: 2, mon_ten_mon: 'Luật Hình sự', mon_so_tin_chi: 2 },
      ],
    };

    // Act
    const filled = renderDocxTemplate(starter, exportData, sections);
    const text = new PizZip(filled).file('word/document.xml')!.asText().replace(/<[^>]+>/g, '');

    // Assert
    expect(text).toContain('Luật Dân sự');
    expect(text).toContain('Luật Hình sự');
    expect(text).toContain('Đã học');
  });
});

/**
 * Dựng một file Word nhỏ từ thân văn bản XML.
 * @param bodyXml  các đoạn văn, bảng
 * @returns        nội dung file .docx
 */
function docxOf(bodyXml: string): ArrayBuffer {
  const zip = new PizZip(createFormStarterDocx([]));
  zip.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${bodyXml}</w:body></w:document>`);
  return zip.generate({ type: 'arraybuffer' });
}

/** Một đoạn văn có chữ. */
const paragraph = (text: string) => `<w:p><w:r><w:t xml:space="preserve">${text}</w:t></w:r></w:p>`;

/** Một hàng bảng, mỗi ô một đoạn văn. */
const tableRow = (cells: string[]) => `<w:tr>${cells.map((cell) => `<w:tc>${paragraph(cell)}</w:tc>`).join('')}</w:tr>`;

/**
 * Chữ trơn của file đã điền, mỗi đoạn văn một dòng, ô bảng cách nhau bằng |.
 * @param filled  file đã điền
 * @returns       chữ
 */
function filledText(filled: ArrayBuffer): string {
  const xml = new PizZip(filled).file('word/document.xml')!.asText();
  return xml.replace(/<\/w:tc>/g, '|').replace(/<\/w:p>/g, '\n').replace(/<[^>]+>/g, '').replace(/\n\|/g, '|').trim();
}

describe('dòng có mã cột tự nhân lên (không cần {#…} {/…})', () => {
  /** Hai bảng: môn (Tên môn), giấy tờ (Tên giấy tờ). */
  const twoTables = [
    FormSectionSchema.parse({
      id: 's1',
      title: 'A',
      questions: [
        { id: 'q1', type: 'table', label: 'Môn', rowName: 'môn', columns: [{ label: 'Tên môn', type: 'text' }] },
        { id: 'q2', type: 'table', label: 'Giấy tờ', rowName: 'giấy tờ', columns: [{ label: 'Tên', type: 'text' }] },
      ],
    }),
  ];
  const exportData = {
    ho_ten: 'An',
    mon: [
      { mon_stt: 1, mon_ten_mon: 'Triết' },
      { mon_stt: 2, mon_ten_mon: 'Luật' },
    ],
    giay_to: [{ giay_to_stt: 1, giay_to_ten: 'Bảng điểm' }],
  };

  test('hàng bảng có mã cột nhân lên mỗi dòng một hàng; mã chung trong hàng vẫn điền được', () => {
    const template = docxOf(`<w:tbl>${tableRow(['STT', 'Môn'])}${tableRow(['{mon_stt}', '{mon_ten_mon} ({ho_ten})'])}</w:tbl>`);
    expect(filledText(renderDocxTemplate(template, exportData, twoTables))).toBe('STT|Môn|1|Triết (An)|2|Luật (An)|');
  });

  test('đoạn văn có mã cột nhân lên mỗi dòng một đoạn; đoạn khác giữ nguyên', () => {
    const template = docxOf(paragraph('Họ tên: {ho_ten}') + paragraph('{mon_stt}. {mon_ten_mon}') + paragraph('Hết'));
    expect(filledText(renderDocxTemplate(template, exportData, twoTables))).toBe('Họ tên: An\n1. Triết\n2. Luật\nHết');
  });

  test('một hàng có mã cột của hai bảng: số hàng theo bảng dài hơn, bảng ngắn để trống phần còn lại', () => {
    const template = docxOf(`<w:tbl>${tableRow(['{mon_ten_mon}', '{giay_to_ten}'])}</w:tbl>`);
    expect(filledText(renderDocxTemplate(template, exportData, twoTables))).toBe('Triết|Bảng điểm|Luật||');
  });

  test('bảng không có dòng nào thì hàng mẫu biến mất', () => {
    const template = docxOf(`<w:tbl>${tableRow(['STT', 'Môn'])}${tableRow(['{mon_stt}', '{mon_ten_mon}'])}</w:tbl>`);
    expect(filledText(renderDocxTemplate(template, { ...exportData, mon: [] }, twoTables))).toBe('STT|Môn|');
  });

  test('mẫu còn {#…} {/…} thì báo lỗi, bảo xóa đi', () => {
    const check = checkDocxTemplate(docxOf(`<w:tbl>${tableRow(['{#mon}{mon_stt}', '{mon_ten_mon}{/mon}'])}</w:tbl>`), twoTables);
    expect(check.error).toContain('{#mon} {/mon}');
    expect(check.unknown).toEqual([]);
  });
});
