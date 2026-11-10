import { describe, expect, test } from 'vitest';
import { buildSamplePdf } from './samplePdf';

describe('buildSamplePdf', () => {
  test('dựng tệp PDF hợp lệ cùng tên, kiểu application/pdf', async () => {
    const pdf = buildSamplePdf('Bang_diem_hoc_ky_2.pdf');
    expect(pdf.name).toBe('Bang_diem_hoc_ky_2.pdf');
    expect(pdf.type).toBe('application/pdf');
    const text = await pdf.text();
    expect(text.startsWith('%PDF-1.4')).toBe(true);
    expect(text.trimEnd().endsWith('%%EOF')).toBe(true);
    expect(text).toContain('Bang_diem_hoc_ky_2.pdf');
  });

  test('vị trí trong bảng xref khớp với từng đối tượng', async () => {
    const text = await buildSamplePdf('a.pdf').text();
    const xrefRows = [...text.matchAll(/^(\d{10}) 00000 n $/gm)].map((match) => Number(match[1]));
    expect(xrefRows).toHaveLength(5);
    xrefRows.forEach((offset, index) => expect(text.slice(offset).startsWith(`${index + 1} 0 obj`)).toBe(true));
  });

  test('bỏ dấu tiếng Việt và ký tự làm hỏng chuỗi PDF trong tên tệp', async () => {
    const text = await buildSamplePdf('Bảng điểm (học kỳ).pdf').text();
    expect(text).toContain('Bang diem hoc ky.pdf');
  });
});
