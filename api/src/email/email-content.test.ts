/* Test dựng thư: thay mã, đổi văn bản có định dạng sang HTML (thoát kí tự đặc biệt), bản chữ thường. */
import { describe, expect, it } from 'vitest';
import { EMAIL_SAMPLE_VALUES, plainTextToRichText, type EmailTagValues, type RichTextDoc } from '@ulaw/shared';
import { buildEmailContent } from './email-content';

/** Dữ liệu mẫu kèm chữ kí. */
const VALUES: EmailTagValues = { ...EMAIL_SAMPLE_VALUES, chu_ki: 'Phòng Đào tạo' };

describe('buildEmailContent', () => {
  it('thay mã ở tiêu đề và nội dung; mã lạ giữ nguyên', () => {
    const content = buildEmailContent('[{ma_don}] {la}', plainTextToRichText('Chào {ho_ten},\n{chu_ki}'), VALUES);
    expect(content.subject).toBe(`[${VALUES.ma_don}] {la}`);
    expect(content.text).toBe(`Chào ${VALUES.ho_ten},\nPhòng Đào tạo`);
    expect(content.html).toContain(`<p style="margin:0 0 12px">Chào ${VALUES.ho_ten},</p>`);
  });

  it('định dạng chữ, tiêu đề, danh sách, xuống dòng thành thẻ HTML', () => {
    const body: RichTextDoc = {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Kết quả' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Mã', marks: [{ type: 'bold' }, { type: 'italic' }] }, { type: 'hardBreak' }, { type: 'text', text: '{ma_don}' }] },
        { type: 'orderedList', attrs: { start: 3 }, content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Một' }] }] }] },
        { type: 'paragraph' },
      ],
    };
    const { html } = buildEmailContent('x', body, VALUES);
    expect(html).toContain('<h2 style="margin:16px 0 8px">Kết quả</h2>');
    expect(html).toContain(`<em><strong>Mã</strong></em><br>${VALUES.ma_don}`);
    expect(html).toContain('<ol style="margin:0 0 12px;padding-left:24px" start="3"><li><p style="margin:0">Một</p></li></ol>');
    expect(html).toContain('<p style="margin:0 0 12px"><br></p>');
  });

  it('chữ có kí tự HTML (kể cả dữ liệu thay vào mã) không thành thẻ', () => {
    const { html } = buildEmailContent('x', plainTextToRichText('<b>{ly_do}</b>'), { ...VALUES, ly_do: '<script>"x" & \'y\'</script>' });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;b&gt;&lt;script&gt;&quot;x&quot; &amp; &#39;y&#39;&lt;/script&gt;&lt;/b&gt;');
  });
});
