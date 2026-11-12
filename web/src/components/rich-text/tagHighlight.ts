/* Mã {…} trong ô soạn (dùng chung cho RichTextEditor và TagTextInput): tô màu mã, kiểu lệnh chèn mã từ bên ngoài.
   Mã dùng được (có trong danh sách truyền vào) tô nền xanh, mã lạ tô đỏ. Chỉ là hiển thị, không đổi nội dung. */
import type { RefObject } from 'react';
import { Extension } from '@tiptap/react';
import { Plugin } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import styles from './RichText.module.css';

/** Các lệnh bên ngoài gọi được vào ô soạn có mã. */
export interface TagInsertControl {
  /** Chèn mã {tag} vào chỗ con trỏ (thay phần đang bôi đen), con trỏ đặt ngay sau mã */
  insertTag: (tag: string) => void;
}

/** Một mã trong chữ: chữ thường không dấu và gạch dưới trong ngoặc nhọn, vd {ho_ten}. */
const TAG_IN_TEXT = /\{([a-z_]+)\}/g;

/**
 * Tiện ích của Tiptap tô màu các mã {…} (tính lại mỗi lần nội dung đổi).
 * @param tagsRef  ref giữ danh sách mã dùng được mới nhất; undefined = không tô
 * @returns        tiện ích Tiptap
 */
export function createTagHighlightExtension(tagsRef: RefObject<readonly string[] | undefined>) {
  return Extension.create({
    name: 'tagHighlight',
    addProseMirrorPlugins() {
      return [
        new Plugin({
          props: {
            decorations(state) {
              const tags = tagsRef.current;
              if (!tags) return null;

              // Mỗi nút chữ: tìm các mã, đổi vị trí trong chữ sang vị trí trong văn bản
              const decorations: Decoration[] = [];
              state.doc.descendants((node, position) => {
                if (!node.isText || !node.text) return;
                for (const match of node.text.matchAll(TAG_IN_TEXT)) {
                  const known = tags.includes(match[1]!);
                  decorations.push(
                    Decoration.inline(position + match.index, position + match.index + match[0].length, {
                      class: (known ? styles.knownTag : styles.unknownTag) ?? '',
                      ...(known ? {} : { title: 'Mã này không có, sẽ giữ nguyên chữ này' }),
                    }),
                  );
                }
              });
              return DecorationSet.create(state.doc, decorations);
            },
          },
        }),
      ];
    },
  });
}
