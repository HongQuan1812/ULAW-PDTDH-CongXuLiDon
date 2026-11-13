import { describe, expect, it } from 'vitest';
import { EMPTY_RICH_TEXT_DOC, plainTextToRichText } from '../aux-schema/rich-text';
import { FORM_NOTE_MESSAGES, SaveFormNoteRequestSchema, formNotePath, formNotesPath } from './form-notes';

describe('SaveFormNoteRequestSchema', () => {
  it('nhận ghi chú có chữ', () => {
    expect(SaveFormNoteRequestSchema.safeParse({ content: plainTextToRichText('Đã gọi điện cho sinh viên') }).success).toBe(true);
  });

  it('từ chối ghi chú trống hoặc chỉ có khoảng trắng, báo đúng câu', () => {
    for (const content of [EMPTY_RICH_TEXT_DOC, plainTextToRichText('   ')]) {
      const parsed = SaveFormNoteRequestSchema.safeParse({ content });
      expect(parsed.success).toBe(false);
      expect(parsed.error?.issues[0]?.message).toBe(FORM_NOTE_MESSAGES.empty);
    }
  });

  it('từ chối nội dung có loại nút lạ', () => {
    const content = { type: 'doc', content: [{ type: 'script', text: 'alert(1)' }] };
    expect(SaveFormNoteRequestSchema.safeParse({ content }).success).toBe(false);
  });
});

describe('đường dẫn ghi chú', () => {
  it('mã đơn và id ghi chú được mã hóa', () => {
    expect(formNotesPath('XMM-2026-001-00001')).toBe('/forms/XMM-2026-001-00001/notes');
    expect(formNotePath('XMM-2026-001-00001', 'note 1')).toBe('/forms/XMM-2026-001-00001/notes/note%201');
  });
});
