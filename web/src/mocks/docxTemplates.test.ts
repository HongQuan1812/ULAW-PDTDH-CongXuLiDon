import PizZip from 'pizzip';
import { beforeEach, describe, expect, test } from 'vitest';
import { buildExportData, type FormSection } from '@ulaw/shared';
import { findExportTemplate, getExportSource, getFormType, resetMockDb } from './db';
import { checkDocxTemplate, openDocx, renderDocxTemplate } from './docxTemplates';

/**
 * Chữ trơn trong thân file Word.
 * @param bytes  nội dung file .docx
 * @returns      chữ, bỏ thẻ XML
 */
function documentText(bytes: ArrayBuffer): string {
  return new PizZip(bytes).file('word/document.xml')!.asText().replace(/<[^>]+>/g, '');
}

beforeEach(() => resetMockDb());

describe('mẫu xuất file Xét miễn môn có sẵn', () => {
  const sampleBytes = () => findExportTemplate('xmm', 'tpl-demo')!.bytes;
  const xmmSections = () => getFormType('xmm')!.sections;

  test('đọc được, mọi mã đều có trong loại đơn', () => {
    expect(openDocx(sampleBytes())).not.toBeNull();
    const check = checkDocxTemplate(sampleBytes(), xmmSections());
    expect(check.error).toBe('');
    expect(check.unknown).toEqual([]);
    expect(check.outside).toEqual([]);
    expect(check.found).toContain('ho_ten');
  });

  test('đổi tên câu hỏi bảng thì báo mã không có trong loại đơn', () => {
    const renamed: FormSection[] = xmmSections().map((section) => ({
      ...section,
      questions: section.questions.map((question) => (question.type === 'table' ? { ...question, tag: 'mon_xin_mien' } : question)),
    }));
    expect(checkDocxTemplate(sampleBytes(), renamed).unknown.length).toBeGreaterThan(0);
  });

  test('điền dữ liệu của một đơn: có họ tên, mã đơn, không còn mã trong ngoặc', () => {
    const exportable = getExportSource('XMM-2026-001-01520')!;
    const filled = renderDocxTemplate(sampleBytes(), buildExportData(exportable.source, '2026-11-11'));
    const text = documentText(filled);
    expect(text).toContain(exportable.source.applicant.name);
    expect(text).toContain('XMM-2026-001-01520');
    expect(text).not.toMatch(/\{[#/]?[a-z_]+\}/);
  });

  test('không phải file Word thì không mở được', () => {
    expect(openDocx(new TextEncoder().encode('không phải docx').buffer)).toBeNull();
  });
});

describe('getExportSource', () => {
  test('người nộp đơn và cán bộ xem mọi đơn thì lấy được; người khác thì không', () => {
    const owner = getExportSource('XMM-2026-001-01520')!;
    expect(owner.formTypeId).toBe('xmm');
    expect(getExportSource('XMM-2026-001-01520', { id: 'cb-1', role: 'nguoiXuLiDon' })).not.toBeNull();
    expect(getExportSource('XMM-2026-001-01520', { id: 'sv-999', role: 'nguoiNopDon' })).toBeNull();
  });
});
