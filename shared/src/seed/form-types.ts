/* Loại đơn mẫu và các phiên bản của chúng. */
import type { FormType } from '../api-contract';
import type { FormSection, FormTypeStatus } from '../aux-schema';
import { FormTypeSchema } from '../api-contract';
import { cloneSeedValue } from './clone';
import { addHours } from './time';

/* Các lựa chọn của cột "Cơ sở đào tạo" (Xét miễn môn); các môn mẫu SAMPLE_SUBJECTS chỉ dùng trường trong danh sách này. */
export const SAMPLE_SCHOOLS = [
  'ĐH KHXH&NV – ĐHQG TP.HCM',
  'ĐH Bách khoa – ĐHQG TP.HCM',
  'ĐH Kinh tế – Luật',
  'ĐH Kinh tế TP.HCM',
  'ĐH Sư phạm TP.HCM',
  'ĐH Công nghiệp TP.HCM',
  'ĐH Mở TP.HCM',
  'ĐH Nông Lâm TP.HCM',
  'ĐH Tôn Đức Thắng',
  'ĐH Ngân hàng TP.HCM',
] as const;

/* Loại đơn ban đầu.
   - Xét miễn môn: loại đơn đầu tiên, có bảng các môn xin miễn.
   - Đơn thử nghiệm: đủ 10 loại câu hỏi, để xem giao diện từng loại khi chưa có trình soạn loại đơn (bước 7).
   Cấu trúc khai báo dạng thô rồi cho qua FormTypeSchema, để điền sẵn giá trị mặc định (required, main…) như máy chủ. */
export const FORM_TYPE_SEED: readonly FormType[] = [
  {
    id: 'xmm',
    name: 'Xét miễn môn',
    prefix: 'XMM',
    description: 'Miễn môn đã học tương đương ở cơ sở đào tạo khác',
    status: 'open',
    sections: [
      {
        id: 's-mon',
        title: 'Đăng ký miễn môn',
        main: true,
        hint: 'Mỗi dòng là một môn của trường bạn muốn xét miễn, kèm môn đã học tương đương ở cơ sở khác.',
        questions: [
          {
            id: 'mon',
            tag: 'mon',
            type: 'table',
            label: 'Các môn xin miễn',
            required: true,
            rowName: 'môn',
            columns: [
              { label: 'Môn học của trường', sub: 'Môn muốn xét miễn', type: 'text', placeholder: 'VD: Luật Hiến pháp' },
              { label: 'Số tín chỉ', type: 'number', placeholder: 'TC', sum: true, sumLabel: 'tín chỉ' },
              { label: 'Môn học tương đương', sub: 'Môn dùng để xét miễn', type: 'text', placeholder: 'Tên môn đã học' },
              // Cột Chọn: người nộp đơn chọn trường trong danh sách Phòng Đào tạo đặt sẵn
              { label: 'Cơ sở đào tạo', sub: 'Nơi dạy môn tương đương', type: 'select', placeholder: 'Chọn trường / cơ sở', options: [...SAMPLE_SCHOOLS] },
            ],
          },
        ],
      },
      {
        id: 's-files',
        title: 'Bảng điểm minh chứng',
        hint: 'Tải lên bảng điểm có xác nhận của cơ sở đào tạo cũ.',
        questions: [
          {
            id: 'files',
            tag: 'tep_bang_diem',
            type: 'file',
            label: 'Tệp bảng điểm',
            required: true,
            accept: ['pdf', 'jpg', 'png'],
            maxMB: 10,
          },
        ],
      },
    ],
  },
  {
    id: 'thu',
    name: 'Đơn thử nghiệm (đủ loại câu hỏi)',
    prefix: 'THU',
    description: 'Có đủ 10 loại câu hỏi, để xem giao diện của từng loại',
    status: 'open',
    sections: [
      {
        id: 's-chu',
        title: 'Chữ, số và ngày',
        main: true,
        hint: 'Câu có dấu * là bắt buộc. Bấm Gửi đơn khi còn trống để xem câu báo lỗi.',
        questions: [
          {
            id: 'info-dau',
            type: 'info',
            content: {
              type: 'doc',
              content: [
                { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Lưu ý' }] },
                { type: 'paragraph', content: [{ type: 'text', text: 'Đây là khối thông báo: không cần trả lời.' }] },
                {
                  type: 'bulletList',
                  content: [
                    { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Nội dung có thể ' }, { type: 'text', text: 'in đậm', marks: [{ type: 'bold' }] }, { type: 'text', text: ' hoặc gạch đầu dòng.' }] }] },
                  ],
                },
              ],
            },
          },
          { id: 'tieu-de', tag: 'tieu_de', type: 'text', label: 'Tiêu đề đơn', required: true, help: 'Trả lời ngắn: không xuống dòng bằng Enter.' },
          { id: 'li-do', tag: 'li_do', type: 'para', label: 'Lí do', help: 'Đoạn văn, viết được nhiều dòng.' },
          { id: 'so-tin-chi', tag: 'so_tin_chi', type: 'number', label: 'Số tín chỉ đã tích lũy', required: true },
          { id: 'ngay-nghi', tag: 'ngay_nghi', type: 'date', label: 'Ngày bắt đầu nghỉ học' },
        ],
      },
      {
        id: 's-chon',
        title: 'Lựa chọn',
        questions: [
          { id: 'hoc-ky', tag: 'hoc_ky', type: 'radio', label: 'Học kỳ đăng ký', required: true, options: ['Học kỳ 1', 'Học kỳ 2', 'Học kỳ hè'] },
          {
            id: 'giay-to', tag: 'giay_to',
            type: 'check',
            label: 'Giấy tờ đã có',
            required: true,
            help: 'Chọn một hoặc nhiều mục.',
            options: ['Bảng điểm', 'Giấy xác nhận sinh viên', 'Đơn có chữ ký phụ huynh'],
          },
          {
            id: 'co-so', tag: 'co_so',
            type: 'select',
            label: 'Cơ sở học',
            options: ['Cơ sở Nguyễn Tất Thành', 'Cơ sở Bình Thạnh', 'Cơ sở Thủ Đức'],
          },
        ],
      },
      {
        id: 's-bang',
        title: 'Bảng và tệp',
        questions: [
          {
            id: 'mon-hoc', tag: 'cac_mon_dang_ky',
            type: 'table',
            label: 'Các môn đã đăng ký',
            help: 'Không bắt buộc: để trống bảng cũng được.',
            rowName: 'môn',
            columns: [
              { label: 'Tên môn', type: 'text', placeholder: 'VD: Luật Dân sự' },
              { label: 'Số tín chỉ', type: 'number', placeholder: 'TC', sum: true, sumLabel: 'tín chỉ' },
              { label: 'Ghi chú', sub: 'Lớp, giảng viên…', type: 'text' },
            ],
          },
          { id: 'tep-dinh-kem', tag: 'tep_dinh_kem', type: 'file', label: 'Tệp đính kèm', accept: ['pdf', 'docx'], maxMB: 5 },
        ],
      },
    ],
  },
  ...[
    ['nhs', 'Xin nghỉ học tạm thời', 'closed'],
    ['blk', 'Xin bảo lưu kết quả học tập', 'closed'],
    ['pkd', 'Phúc khảo điểm thi', 'closed'],
    ['cnh', 'Xin chuyển ngành', 'closed'],
    ['cbd', 'Xin cấp bảng điểm', 'closed'],
    ['xnsv', 'Xin giấy xác nhận sinh viên', 'closed'],
    ['hth', 'Xin hoãn thi', 'draft'],
    ['hv', 'Xin học vượt', 'draft'],
    ['hl', 'Đăng ký học lại', 'draft'],
    ['cltsv', 'Xin cấp lại thẻ sinh viên', 'draft'],
  ].map(([id, name, status]) => ({
    id,
    name,
    prefix: id!.toUpperCase(),
    description: `${name} (loại đơn mẫu để thử giao diện)`,
    status,
    sections: [
      {
        id: 's-chung',
        title: 'Thông tin đơn',
        main: true,
        questions: [{ id: 'li-do', type: 'para', label: 'Lí do', required: true }],
      },
    ],
  })),
].map((rawFormType) => FormTypeSchema.parse(rawFormType));

/** Một phiên bản loại đơn trong API giả: nội dung, trạng thái, lần lưu gần nhất (id cán bộ). */
export interface SeedFormTypeVersion {
  version: number;
  status: FormTypeStatus;
  name: string;
  description: string | null;
  sections: FormSection[];
  updatedAt: string;
  updatedById: string;
}

/** Một loại đơn trong API giả: mã loại đơn, mã đơn, các phiên bản (cũ trước, mới sau). */
export interface SeedFormType {
  id: string;
  prefix: string;
  versions: SeedFormTypeVersion[];
}

/**
 * Lần lưu gần nhất của loại đơn mẫu thứ i:
 * Xét miễn môn lưu ngày 01/09/2026; các loại khác lùi dần mỗi loại 6 ngày, giờ lưu trong giờ hành chính, lần lượt 3 cán bộ mẫu.
 * @param i  vị trí trong FORM_TYPE_SEED
 * @returns  lúc lưu, id cán bộ lưu
 */
function seedUpdate(i: number): { updatedAt: string; updatedById: string } {
  if (i === 0) return { updatedAt: '2026-09-01T08:00', updatedById: 'cb-1' };
  return {
    updatedAt: `${addHours('2026-11-05T00:00', -(i - 1) * 144).slice(0, 10)}T${String(8 + ((i * 3) % 9)).padStart(2, '0')}:${String((i * 17) % 60).padStart(2, '0')}`,
    updatedById: `cb-${((i - 1) % 3) + 1}`,
  };
}

/**
 * Dựng các loại đơn ban đầu, mỗi loại một phiên bản (phiên bản 1) theo FORM_TYPE_SEED.
 * Riêng đơn thử nghiệm có thêm phiên bản 1 cũ (Đã đóng, chỉ có phần đầu), để thấy cách hiện nhiều phiên bản.
 * @returns  các loại đơn
 */
export function seedFormTypes(): SeedFormType[] {
  return FORM_TYPE_SEED.map((formType, i) => {
    const { id, prefix, name, description, status, sections } = cloneSeedValue(formType);
    const latest: SeedFormTypeVersion = { version: 1, status, name, description, sections, ...seedUpdate(i) };
    if (id !== 'thu') return { id, prefix, versions: [latest] };
    const firstVersion: SeedFormTypeVersion = {
      ...cloneSeedValue(latest),
      status: 'closed',
      sections: cloneSeedValue(sections.slice(0, 1)),
      updatedAt: '2026-08-14T09:30',
      updatedById: 'cb-2',
    };
    return { id, prefix, versions: [firstVersion, { ...latest, version: 2 }] };
  });
}
