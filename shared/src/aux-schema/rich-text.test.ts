import { describe, expect, it } from 'vitest';
import { EMPTY_RICH_TEXT_DOC, RichTextDocSchema } from './rich-text';
import { INFO_BLOCK_COLORS, QuestionSchema } from './form-types--question-types';

const sampleDoc = {
  type: 'doc',
  content: [
    { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Lưu ý' }] },
    { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Mục một' }] }] }] },
    { type: 'paragraph', content: [{ type: 'text', text: 'đậm', marks: [{ type: 'bold' }, { type: 'underline' }] }] },
  ],
};

describe('RichTextDocSchema', () => {
  it('nhận văn bản có tiêu đề, danh sách, chữ đậm / gạch chân', () => {
    expect(RichTextDocSchema.safeParse(sampleDoc).success).toBe(true);
  });

  it('nhận văn bản trống mặc định', () => {
    expect(RichTextDocSchema.safeParse(EMPTY_RICH_TEXT_DOC).success).toBe(true);
  });

  it('từ chối gốc không phải "doc"', () => {
    expect(RichTextDocSchema.safeParse({ type: 'paragraph' }).success).toBe(false);
  });

  it('từ chối loại nút lạ (vd script) và định dạng lạ', () => {
    expect(RichTextDocSchema.safeParse({ type: 'doc', content: [{ type: 'script' }] }).success).toBe(false);
    const withUnknownMark = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'a', marks: [{ type: 'link' }] }] }] };
    expect(RichTextDocSchema.safeParse(withUnknownMark).success).toBe(false);
  });
});

describe('khối thông báo', () => {
  it('chỉ có id, type và content (không còn tiêu đề)', () => {
    const block = QuestionSchema.parse({ id: 'i1', type: 'info', content: sampleDoc });
    expect(block).toEqual({ id: 'i1', type: 'info', content: sampleDoc });
  });

  it('bắt buộc có content', () => {
    expect(QuestionSchema.safeParse({ id: 'i1', type: 'info' }).success).toBe(false);
  });

  it('chọn được màu nền trong bộ màu có sẵn; không chọn thì là màu mặc định (không có trường color)', () => {
    INFO_BLOCK_COLORS.forEach((color) => {
      expect(QuestionSchema.safeParse({ id: 'i1', type: 'info', content: sampleDoc, color }).success).toBe(true);
    });
    expect(QuestionSchema.parse({ id: 'i1', type: 'info', content: sampleDoc })).not.toHaveProperty('color');
  });

  it('từ chối màu ngoài bộ màu (vd mã màu tự gõ)', () => {
    expect(QuestionSchema.safeParse({ id: 'i1', type: 'info', content: sampleDoc, color: '#ff0000' }).success).toBe(false);
  });
});
