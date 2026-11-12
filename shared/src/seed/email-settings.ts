/* Cấu hình email mẫu. */
import type { EmailSettings } from '../api-contract';
import type { RichTextDoc, RichTextNode } from '../aux-schema';

/**
 * Thư viết dạng chữ thường thành văn bản có định dạng: dòng trống ngăn đoạn, xuống dòng trong đoạn thành xuống dòng cứng.
 * @param letterText  nội dung thư dạng chữ thường
 * @returns           văn bản có định dạng (mỗi đoạn một nút "paragraph")
 */
function letterToRichText(letterText: string): RichTextDoc {
  return {
    type: 'doc',
    content: letterText.split('\n\n').map((paragraphText) => ({
      type: 'paragraph',
      content: paragraphText
        .split('\n')
        .flatMap((line, index): RichTextNode[] => [...(index > 0 ? [{ type: 'hardBreak' as const }] : []), { type: 'text', text: line }]),
    })),
  };
}

/* Cấu hình ban đầu. Chỉ giữ trong bộ nhớ: tải lại trang là về ban đầu. */
export const EMAIL_SETTINGS_SEED: EmailSettings = {
  sender: {
    name: 'Phòng Đào tạo Đại học - ULAW',
    signature: 'Phòng Đào tạo Đại học, Trường Đại học Luật TP.HCM',
  },
  events: [
    {
      status: 'nop',
      enabled: true,
      subject: '[{ma_don}] Đã nhận đơn {loai_don} của bạn',
      body: letterToRichText(`Chào {ho_ten},

Phòng Đào tạo đã nhận đơn {loai_don} bạn nộp ngày {ngay_nop}. Mã đơn của bạn là {ma_don}.

Chúng tôi sẽ tiếp nhận và xử lí trong thời gian sớm nhất. Bạn xem tiến độ xử lí tại:
{link_don}

Trân trọng,
{chu_ki}`),
    },
    {
      status: 'bs',
      enabled: true,
      subject: '[{ma_don}] Đơn của bạn cần bổ sung',
      body: letterToRichText(`Chào {ho_ten},

Đơn {loai_don} mã {ma_don} cần bổ sung thông tin:

{ly_do}

Bạn vào đơn để sửa và nộp lại:
{link_don}

Trân trọng,
{nguoi_xu_li}
{chu_ki}`),
    },
    {
      status: 'tc',
      enabled: true,
      subject: '[{ma_don}] Đơn của bạn không được duyệt',
      body: letterToRichText(`Chào {ho_ten},

Rất tiếc, đơn {loai_don} mã {ma_don} không được duyệt.

Lí do: {ly_do}

Bạn xem chi tiết tại:
{link_don}

Trân trọng,
{nguoi_xu_li}
{chu_ki}`),
    },
    {
      status: 'duyet',
      enabled: true,
      subject: '[{ma_don}] Đơn của bạn đã được duyệt',
      body: letterToRichText(`Chào {ho_ten},

Đơn {loai_don} mã {ma_don} đã được duyệt.

Bạn xem kết quả và tải file tại:
{link_don}

Trân trọng,
{nguoi_xu_li}
{chu_ki}`),
    },
  ],
};

/** Lần lưu cấu hình email ban đầu: lúc nào (giờ Việt Nam), cán bộ nào. */
export const EMAIL_SETTINGS_SEED_UPDATE = { updatedAt: '2026-11-03T14:20', updatedById: 'cb-1' };
