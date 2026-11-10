import { describe, expect, test } from 'vitest';
import { previewKindOf } from './files';

describe('previewKindOf', () => {
  test('nhận ra loại tệp xem trước được theo đuôi, không phân biệt hoa thường', () => {
    expect(previewKindOf('bang-diem.pdf')).toBe('pdf');
    expect(previewKindOf('ANH.JPG')).toBe('image');
    expect(previewKindOf('scan.jpeg')).toBe('image');
    expect(previewKindOf('scan.png')).toBe('image');
    expect(previewKindOf('mau.docx')).toBe('word');
  });

  test('Excel, .doc cũ và đuôi lạ chưa xem trước được (chỉ tải về)', () => {
    expect(previewKindOf('so-lieu.xlsx')).toBe('none');
    expect(previewKindOf('so-lieu.xls')).toBe('none');
    expect(previewKindOf('cu.doc')).toBe('none');
    expect(previewKindOf('ghi-chu.txt')).toBe('none');
    expect(previewKindOf('khong-duoi')).toBe('none');
  });

  test('chỉ xét đuôi cuối cùng', () => {
    expect(previewKindOf('ban.pdf.docx')).toBe('word');
    expect(previewKindOf('.pdf')).toBe('pdf');
  });
});
