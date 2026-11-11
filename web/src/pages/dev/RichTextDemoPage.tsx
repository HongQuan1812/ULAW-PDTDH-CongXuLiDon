/* Trang thử tạm cho trình soạn văn bản (#/thu-soan-van-ban). Xóa khi đã gắn trình soạn vào câu hỏi / mô tả phần. */
import { useState } from 'react';
import { RichTextEditor } from '../../components/rich-text/RichTextEditor';
import { RichTextView } from '../../components/rich-text/RichTextView';
import type { RichTextDoc } from '../../components/rich-text/richTextExtensions';

/**
 * Trang thử trình soạn văn bản: ô soạn, cách hiện chỉ xem và JSON sẽ lưu.
 * @returns  trang thử
 */
export function RichTextDemoPage() {
  const [doc, setDoc] = useState<RichTextDoc | null>(null);
  return (
    <div style={{ display: 'grid', gap: 20, maxWidth: 760, margin: '0 auto', padding: 24 }}>
      <h1>Thử trình soạn văn bản</h1>
      <RichTextEditor value={doc} onChange={setDoc} label="Nội dung thử" placeholder="Gõ thử: # tiêu đề, - gạch đầu dòng, Ctrl+B…" />
      <h2>Chỉ xem</h2>
      <RichTextView value={doc} />
      <h2>JSON sẽ lưu</h2>
      <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>{JSON.stringify(doc, null, 1)}</pre>
    </div>
  );
}
