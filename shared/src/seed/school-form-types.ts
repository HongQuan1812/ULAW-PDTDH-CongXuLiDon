/* Loại đơn thật của Phòng Đào tạo Đại học, dựng theo mẫu Word (Google Drive, thư mục CongXuLiDon/Mẫu Đơn).
   Dùng cho cả seed dev (FORM_TYPE_SEED) lẫn seed bản thật (api/prisma/production-seed.ts: chỉ thêm loại đơn chưa có, không ghi đè bản Admin đã sửa).
   Mỗi loại đơn một phiên bản (phiên bản 1). Cấu trúc khai báo dạng thô rồi cho qua FormTypeSchema, để điền sẵn giá trị mặc định như máy chủ. */
import type { FormType } from '../api-contract';
import { FormTypeSchema } from '../api-contract';

export const SCHOOL_FORM_TYPES_SEED: readonly FormType[] = [
  // Mẫu số 1.1/ĐNĐKHPM: Đơn đề nghị đăng ký học học phần muộn
  {
    id: 'dkhpm',
    name: 'Đăng ký học phần muộn',
    prefix: 'DKHPM',
    description: 'Đăng ký học thêm, hoặc đăng ký sang học phần khác khi học phần đã đăng ký không mở lớp',
    status: 'draft',
    sections: [
      {
        id: 's-hoc-phan',
        title: 'Đăng ký học phần muộn',
        main: true,
        hint: 'Mỗi dòng là một học phần bạn xin đăng ký muộn.',
        questions: [
          {
            id: 'info-luu-y',
            type: 'info',
            color: 'blue',
            content: {
              type: 'doc',
              content: [
                { type: 'paragraph', content: [{ type: 'text', text: 'Áp dụng cho sinh viên muốn đăng ký học thêm hoặc đăng ký sang học phần khác khi học phần đã đăng ký không mở lớp.' }] },
                {
                  type: 'bulletList',
                  content: [
                    {
                      type: 'listItem',
                      content: [
                        {
                          type: 'paragraph',
                          content: [
                            { type: 'text', text: 'Nộp đơn trước khi học phần được tổ chức giảng dạy theo kế hoạch, ' },
                            { type: 'text', text: 'tối thiểu 5 ngày làm việc', marks: [{ type: 'bold' }] },
                            { type: 'text', text: '.' },
                          ],
                        },
                      ],
                    },
                    {
                      type: 'listItem',
                      content: [
                        {
                          type: 'paragraph',
                          content: [
                            {
                              type: 'text',
                              text: 'Sau 07 ngày làm việc (tính từ ngày nộp đơn), kiểm tra kết quả trên tài khoản đào tạo của sinh viên và thực hiện các nghĩa vụ khác theo quy định của Trường.',
                            },
                          ],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          },
          { id: 'hoc-ky', type: 'radio', label: 'Học kỳ', required: true, options: ['Học kỳ 1', 'Học kỳ 2'] },
          { id: 'nam-hoc', type: 'text', label: 'Năm học', required: true, help: 'VD: 2026 - 2027' },
          {
            id: 'hoc-phan',
            type: 'table',
            label: 'Các học phần xin đăng ký muộn',
            required: true,
            help: 'Ghi đầy đủ tên học phần, vd: Luật Hình sự phần chung.',
            rowName: 'học phần',
            columns: [
              { label: 'Tên học phần', type: 'text', placeholder: 'VD: Luật Hình sự phần chung' },
              { label: 'Số tín chỉ', type: 'number', placeholder: 'TC', sum: true, sumLabel: 'tín chỉ' },
              { label: 'Lớp đăng ký', type: 'text', placeholder: 'Lớp học phần' },
              { label: 'Học từ ngày', type: 'date' },
              { label: 'Học đến ngày', type: 'date' },
            ],
          },
        ],
      },
      {
        id: 's-li-do',
        title: 'Lí do và cam kết',
        questions: [
          { id: 'li-do', type: 'para', label: 'Lí do đề nghị', required: true },
          {
            id: 'cam-ket',
            type: 'check',
            label: 'Cam kết',
            required: true,
            options: [
              'Tôi cam kết đảm bảo đúng thời gian lịch học, chịu trách nhiệm về kết quả học tập và tuân thủ các quy định, quy chế của Trường nếu được Phòng Đào tạo Đại học đồng ý cho đăng ký các học phần muộn nêu trên.',
            ],
          },
        ],
      },
    ],
  },

  // Mẫu số 1.2/ĐNĐKHL-HCT: Đơn đề nghị đăng ký học học lại, học cải thiện
  {
    id: 'hlct',
    name: 'Đăng ký học lại, học cải thiện',
    prefix: 'HLCT',
    description: 'Đăng ký học lại học phần chưa đạt, hoặc học cải thiện học phần đã đạt',
    status: 'draft',
    sections: [
      {
        id: 's-hoc-phan',
        title: 'Đăng ký học lại, học cải thiện',
        main: true,
        hint: 'Mỗi dòng là một học phần bạn xin học lại hoặc học cải thiện.',
        questions: [
          {
            id: 'info-luu-y',
            type: 'info',
            color: 'blue',
            content: {
              type: 'doc',
              content: [
                {
                  type: 'bulletList',
                  content: [
                    {
                      type: 'listItem',
                      content: [
                        {
                          type: 'paragraph',
                          content: [
                            { type: 'text', text: 'Nộp đơn trước khi học phần được tổ chức giảng dạy theo kế hoạch, ' },
                            { type: 'text', text: 'tối thiểu 5 ngày làm việc', marks: [{ type: 'bold' }] },
                            { type: 'text', text: '.' },
                          ],
                        },
                      ],
                    },
                    {
                      type: 'listItem',
                      content: [
                        {
                          type: 'paragraph',
                          content: [
                            {
                              type: 'text',
                              text: 'Sau 07 ngày làm việc (tính từ ngày nộp đơn), kiểm tra kết quả trên tài khoản đào tạo của sinh viên và thực hiện các nghĩa vụ khác theo quy định của Trường.',
                            },
                          ],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          },
          { id: 'hoc-ky', type: 'radio', label: 'Học kỳ', required: true, options: ['Học kỳ 1', 'Học kỳ 2'] },
          { id: 'nam-hoc', type: 'text', label: 'Năm học', required: true, help: 'VD: 2026 - 2027' },
          {
            id: 'hoc-phan',
            type: 'table',
            label: 'Các học phần xin học lại, học cải thiện',
            required: true,
            help: 'Ghi đầy đủ tên học phần, vd: Luật Hình sự phần chung.',
            rowName: 'học phần',
            columns: [
              { label: 'Tên học phần', type: 'text', placeholder: 'VD: Luật Hình sự phần chung' },
              { label: 'Số tín chỉ', type: 'number', placeholder: 'TC', sum: true, sumLabel: 'tín chỉ' },
              { label: 'Học phần đăng ký', type: 'select', options: ['Học lại', 'Học cải thiện'] },
              { label: 'Lớp đăng ký', type: 'text', placeholder: 'Lớp học phần' },
              { label: 'Thời gian bắt đầu học', type: 'date' },
            ],
          },
        ],
      },
      {
        id: 's-cam-ket',
        title: 'Cam kết',
        questions: [
          {
            id: 'cam-ket',
            type: 'check',
            label: 'Cam kết',
            required: true,
            options: [
              'Tôi cam kết đảm bảo đúng thời gian lịch học, chịu trách nhiệm về kết quả học tập và tuân thủ các quy định, quy chế của Trường nếu được Phòng Đào tạo Đại học đồng ý cho đăng ký các học phần học lại, học cải thiện nêu trên.',
            ],
          },
        ],
      },
    ],
  },
].map((rawFormType) => FormTypeSchema.parse(rawFormType));
