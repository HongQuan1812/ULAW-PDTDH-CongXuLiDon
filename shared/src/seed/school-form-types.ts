/* Loại đơn thật của Phòng Đào tạo Đại học, dựng theo mẫu Word (Google Drive, thư mục CongXuLiDon/Mẫu Đơn), 32 mẫu theo thứ tự trong plan.
   Dùng cho cả seed dev (FORM_TYPE_SEED) lẫn seed bản thật (api/prisma/production-seed.ts: chỉ thêm loại đơn chưa có, không ghi đè bản Admin đã sửa).
   Mỗi loại đơn một phiên bản (phiên bản 1), để Nháp. Cấu trúc khai báo dạng thô rồi cho qua FormTypeSchema, để điền sẵn giá trị mặc định như máy chủ.
   Lấy từ bản đã duyệt trên trình soạn (database dev); sửa thì sửa trên trình soạn rồi xuất lại, không sửa tay từng câu. */
import type { FormType } from '../api-contract';
import { FormTypeSchema } from '../api-contract';

export const SCHOOL_FORM_TYPES_SEED: readonly FormType[] = [
  // 1. Mẫu số 1.1/ĐNĐKHPM: Đơn đề nghị đăng ký học học phần muộn
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
                {
                  type: 'paragraph',
                  content: [
                    { type: 'text', text: 'Áp dụng cho sinh viên muốn đăng ký học thêm hoặc đăng ký sang học phần khác khi học phần đã đăng ký không mở lớp.' },
                  ],
                },
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
          { id: 'nam-hoc', type: 'text', label: 'Năm học', required: true, placeholder: 'VD: 2026 - 2027' },
          {
            id: 'hoc-phan',
            type: 'table',
            label: 'Các học phần xin đăng ký muộn',
            required: true,
            help: 'Ghi đầy đủ tên học phần.',
            columns: [
              { type: 'text', label: 'Tên học phần', placeholder: 'VD: Luật Hình sự phần chung' },
              { type: 'number', label: 'Số tín chỉ', sum: true, sumLabel: 'tín chỉ', placeholder: 'TC' },
              { type: 'text', label: 'Lớp đăng ký', placeholder: 'Lớp học phần' },
              { type: 'date', label: 'Học từ ngày' },
              { type: 'date', label: 'Học đến ngày' },
            ],
            rowName: 'học phần',
          },
        ],
      },
      {
        id: 's-li-do',
        title: 'Lí do và cam kết',
        main: false,
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

  // 2. Mẫu số 1.2/ĐNĐKHL-HCT: Đơn đề nghị đăng ký học học lại, học cải thiện
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
          { id: 'nam-hoc', type: 'text', label: 'Năm học', required: true, placeholder: 'VD: 2026 - 2027' },
          {
            id: 'hoc-phan',
            type: 'table',
            label: 'Các học phần xin học lại, học cải thiện',
            required: true,
            help: 'Ghi đầy đủ tên học phần.',
            columns: [
              { type: 'text', label: 'Tên học phần', placeholder: 'VD: Luật Hình sự phần chung' },
              { type: 'number', label: 'Số tín chỉ', sum: true, sumLabel: 'tín chỉ', placeholder: 'TC' },
              { type: 'select', label: 'Học phần đăng ký', options: ['Học lại', 'Học cải thiện'] },
              { type: 'text', label: 'Lớp đăng ký', placeholder: 'Lớp học phần' },
              { type: 'date', label: 'Thời gian bắt đầu học' },
            ],
            rowName: 'học phần',
          },
        ],
      },
      {
        id: 's-cam-ket',
        title: 'Cam kết',
        main: false,
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

  // 3. Mẫu số 1.3/ĐKBSHP: Đơn đề nghị đăng ký học bổ sung học phần
  {
    id: 'bshp',
    name: 'Đăng ký học bổ sung học phần',
    prefix: 'BSHP',
    description: 'Đăng ký học bổ sung học phần khi đã được tạm hoãn học, chuyển lớp, chuyển chương trình đào tạo, hoặc để bổ sung kiến thức',
    status: 'draft',
    sections: [
      {
        id: 's-hoc-phan',
        title: 'Đăng ký học bổ sung học phần',
        main: true,
        hint: 'Mỗi dòng là một học phần bạn xin học bổ sung.',
        questions: [
          {
            id: 'info-luu-y',
            type: 'info',
            color: 'blue',
            content: {
              type: 'doc',
              content: [
                {
                  type: 'paragraph',
                  content: [
                    {
                      type: 'text',
                      text: 'Áp dụng cho sinh viên đã được xét cho tạm hoãn học học phần; hoặc chuyển lớp, chuyển chương trình đào tạo trong quá trình học; hoặc đăng ký học bổ sung kiến thức.',
                    },
                  ],
                },
                {
                  type: 'bulletList',
                  content: [
                    {
                      type: 'listItem',
                      content: [
                        {
                          type: 'paragraph',
                          content: [
                            {
                              type: 'text',
                              text: 'Nộp đơn kèm kết quả giải quyết cho hoãn học, hoặc quyết định cho phép chuyển lớp, chuyển chương trình đào tạo.',
                            },
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
                            { type: 'text', text: 'Nộp đơn ' },
                            { type: 'text', text: 'trước 10 ngày làm việc', marks: [{ type: 'bold' }] },
                            { type: 'text', text: ' tính từ ngày bắt đầu học của học phần.' },
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
          { id: 'nam-hoc', type: 'text', label: 'Năm học', required: true, placeholder: 'VD: 2026 - 2027' },
          {
            id: 'hoc-phan',
            type: 'table',
            label: 'Các học phần xin học bổ sung',
            required: true,
            help: 'Ghi đầy đủ tên học phần.',
            columns: [
              { type: 'text', label: 'Tên học phần', placeholder: 'VD: Luật Hình sự phần chung' },
              { type: 'number', label: 'Số tín chỉ', sum: true, sumLabel: 'tín chỉ', placeholder: 'TC' },
              { type: 'text', label: 'Lớp đăng ký', placeholder: 'Lớp học phần' },
              { type: 'date', label: 'Học từ ngày' },
              { type: 'date', label: 'Học đến ngày' },
            ],
            rowName: 'học phần',
          },
        ],
      },
      {
        id: 's-li-do',
        title: 'Lí do đề nghị',
        main: false,
        questions: [
          {
            id: 'truong-hop',
            type: 'radio',
            label: 'Tôi là sinh viên thuộc trường hợp',
            required: true,
            options: [
              'Được xét cho tạm hoãn học học phần',
              'Được xét cho chuyển lớp, chuyển chương trình đào tạo',
              'Đăng ký học để bổ sung kiến thức theo nguyện vọng cá nhân (học phần tự chọn, học phần bổ sung, học phần thay thế trong chương trình đào tạo)',
            ],
          },
          {
            id: 'hoc-ky-duoc-xet',
            type: 'text',
            label: 'Học kỳ, năm học được xét tạm hoãn, chuyển lớp, chuyển chương trình',
            required: false,
            help: 'Trường hợp tạm hoãn hoặc chuyển lớp, chuyển chương trình đào tạo.', placeholder: 'VD: Học kỳ 1, năm học 2026 - 2027',
          },
          {
            id: 'minh-chung',
            type: 'file',
            label: 'Kết quả giải quyết cho hoãn học, hoặc quyết định chuyển lớp, chuyển chương trình đào tạo',
            required: false,
            help: 'Trường hợp tạm hoãn hoặc chuyển lớp, chuyển chương trình đào tạo.',
            maxMB: 5,
            accept: ['pdf', 'jpg', 'png'],
          },
        ],
      },
    ],
  },

  // 4. Mẫu số 1.4/ĐNRB-HHPĐĐK: Đơn đề nghị rút bớt, hủy các học phần đã đăng ký
  {
    id: 'rbhp',
    name: 'Rút bớt, hủy học phần đã đăng ký',
    prefix: 'RBHP',
    description: 'Rút bớt hoặc hủy học phần đã đăng ký: theo kế hoạch, học lại, học cải thiện, ngoại khóa, tự chọn',
    status: 'draft',
    sections: [
      {
        id: 's-hoc-phan',
        title: 'Rút bớt, hủy học phần',
        main: true,
        hint: 'Mỗi dòng là một học phần bạn xin rút bớt, hủy.',
        questions: [
          {
            id: 'info-luu-y',
            type: 'info',
            color: 'blue',
            content: {
              type: 'doc',
              content: [
                {
                  type: 'paragraph',
                  content: [
                    {
                      type: 'text',
                      text: 'Áp dụng cho sinh viên muốn rút bớt, hủy các học phần trong khối lượng học tập đã đăng ký theo kế hoạch, học lại, học cải thiện, học phần ngoại khóa, học phần tự chọn.',
                    },
                  ],
                },
              ],
            },
          },
          { id: 'hoc-ky', type: 'radio', label: 'Học kỳ', required: true, options: ['Học kỳ 1', 'Học kỳ 2'] },
          { id: 'nam-hoc', type: 'text', label: 'Năm học', required: true, placeholder: 'VD: 2026 - 2027' },
          {
            id: 'hoc-phan',
            type: 'table',
            label: 'Các học phần xin rút bớt, hủy',
            required: true,
            help: 'Ghi đầy đủ tên học phần.',
            columns: [
              { type: 'text', label: 'Tên học phần', placeholder: 'VD: Luật Hình sự phần chung' },
              { type: 'number', label: 'Số tín chỉ', sum: true, sumLabel: 'tín chỉ', placeholder: 'TC' },
              { type: 'text', label: 'Lớp đăng ký', placeholder: 'Lớp học phần' },
              { type: 'date', label: 'Học từ ngày' },
              { type: 'date', label: 'Học đến ngày' },
            ],
            rowName: 'học phần',
          },
        ],
      },
      {
        id: 's-li-do',
        title: 'Lí do và cam kết',
        main: false,
        questions: [
          { id: 'li-do', type: 'para', label: 'Lí do đề nghị', required: true },
          { id: 'minh-chung', type: 'file', label: 'Giấy tờ minh chứng', required: false, maxMB: 5, accept: ['pdf', 'jpg', 'png'] },
          {
            id: 'cam-ket',
            type: 'check',
            label: 'Cam kết',
            required: true,
            options: [
              'Tôi cam kết đã rà soát đủ số tín chỉ theo chương trình đào tạo và tôi hoàn toàn tự nguyện, tự chịu trách nhiệm với thông tin đề nghị rút bớt, hủy đăng ký học phần nêu trên. Nếu được Trưởng phòng Đào tạo Đại học chấp thuận theo nguyện vọng, tôi cam kết sẽ thực hiện và tuân thủ đầy đủ các quy định của Trường.',
            ],
          },
        ],
      },
    ],
  },

  // 5. Mẫu số 2.1/ĐKDTKTHP: Đơn đăng ký dự thi kết thúc học phần
  {
    id: 'dkdt',
    name: 'Đăng ký dự thi kết thúc học phần',
    prefix: 'DKDT',
    description: 'Đăng ký dự thi kết thúc học phần sau khi đã được giải quyết cho hoãn thi',
    status: 'draft',
    sections: [
      {
        id: 's-hoc-phan',
        title: 'Đăng ký dự thi',
        main: true,
        hint: 'Mỗi dòng là một học phần bạn đăng ký dự thi.',
        questions: [
          {
            id: 'info-luu-y',
            type: 'info',
            color: 'blue',
            content: {
              type: 'doc',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Áp dụng cho sinh viên đã được giải quyết cho hoãn thi kết thúc học phần.' }] }],
            },
          },
          { id: 'hoc-ky', type: 'radio', label: 'Học kỳ', required: true, options: ['Học kỳ 1', 'Học kỳ 2'] },
          { id: 'nam-hoc', type: 'text', label: 'Năm học', required: true, placeholder: 'VD: 2026 - 2027' },
          {
            id: 'hoc-phan',
            type: 'table',
            label: 'Các học phần đăng ký dự thi',
            required: true,
            help: 'Ghi đầy đủ tên học phần.',
            columns: [
              { type: 'text', label: 'Tên học phần', placeholder: 'VD: Luật Hình sự phần chung' },
              { type: 'text', label: 'Đăng ký thi với lớp', placeholder: 'Lớp học phần' },
              { type: 'text', label: 'Thời gian thi ', sub: '', placeholder: 'VD: 7h30' },
              { type: 'date', label: 'Ngày thi' },
            ],
            rowName: 'học phần',
          },
        ],
      },
      {
        id: 's-li-do',
        title: 'Lí do đề nghị',
        main: false,
        questions: [
          {
            id: 'hoan-thi',
            type: 'text',
            label: 'Học kỳ, năm học đã được hoãn thi',
            required: true,
            help: 'Tôi là sinh viên đã được Trường giải quyết cho hoãn thi kết thúc học phần.', placeholder: 'VD: Học kỳ 1, năm học 2026 - 2027',
          },
          {
            id: 'minh-chung',
            type: 'file',
            label: 'Giấy tờ minh chứng',
            required: true,
            help: 'Kết quả giải quyết cho hoãn thi.',
            maxMB: 5,
            accept: ['pdf', 'jpg', 'png'],
          },
        ],
      },
    ],
  },

  // 6. Mẫu số 2.2/ĐNCLTKTHP: Đơn đề nghị chuyển lịch thi kết thúc học phần
  {
    id: 'clt',
    name: 'Chuyển lịch thi kết thúc học phần',
    prefix: 'CLT',
    description: 'Chuyển lịch thi kết thúc học phần khi trùng lịch thi học lại, học cải thiện, hoặc có lí do chính đáng khác',
    status: 'draft',
    sections: [
      {
        id: 's-hoc-phan',
        title: 'Chuyển lịch thi',
        main: true,
        hint: 'Mỗi dòng là một học phần bạn xin chuyển lịch thi.',
        questions: [
          {
            id: 'info-luu-y',
            type: 'info',
            color: 'blue',
            content: {
              type: 'doc',
              content: [
                {
                  type: 'paragraph',
                  content: [
                    {
                      type: 'text',
                      text: 'Áp dụng cho sinh viên đã đăng ký học các học phần cải thiện, học lại bị trùng lịch thi kết thúc học phần, hoặc có lí do chính đáng khác.',
                    },
                  ],
                },
              ],
            },
          },
          { id: 'hoc-ky', type: 'radio', label: 'Học kỳ', required: true, options: ['Học kỳ 1', 'Học kỳ 2'] },
          { id: 'nam-hoc', type: 'text', label: 'Năm học', required: true, placeholder: 'VD: 2026 - 2027' },
          {
            id: 'hoc-phan',
            type: 'table',
            label: 'Các học phần xin chuyển lịch thi',
            required: true,
            help: 'Ghi đầy đủ tên học phần.',
            columns: [
              { type: 'text', label: 'Tên học phần', placeholder: 'VD: Luật Hình sự phần chung' },
              { type: 'text', label: 'Lớp dự thi cũ' },
              { type: 'text', label: 'Thời gian thi cũ', placeholder: 'VD: 7h30' },
              { type: 'date', label: 'Ngày thi cũ' },
              { type: 'text', label: 'Lớp dự thi mới' },
              { type: 'text', label: 'Thời gian thi mới', placeholder: 'VD: 7h30' },
              { type: 'date', label: 'Ngày thi mới' },
            ],
            rowName: 'học phần',
          },
        ],
      },
      {
        id: 's-li-do',
        title: 'Lí do đề nghị',
        main: false,
        questions: [
          {
            id: 'truong-hop',
            type: 'radio',
            label: 'Tôi là sinh viên thuộc trường hợp',
            required: true,
            options: ['Đã đăng ký học các học phần cải thiện, học lại bị trùng lịch thi kết thúc học phần', 'Lí do khác'],
          },
          { id: 'li-do-khac', type: 'para', label: 'Lí do khác', required: false, help: 'Ghi rõ nếu chọn Lí do khác.' },
          { id: 'minh-chung', type: 'file', label: 'Giấy tờ minh chứng', required: true, maxMB: 5, accept: ['pdf', 'jpg', 'png'] },
        ],
      },
    ],
  },

  // 7. Mẫu số 2.3/ĐNHTKTHP: Đơn đề nghị hoãn thi kết thúc học phần
  {
    id: 'hthp',
    name: 'Hoãn thi kết thúc học phần',
    prefix: 'HTHP',
    description: 'Hoãn thi kết thúc học phần vì đi công tác, sức khỏe hoặc lí do khác',
    status: 'draft',
    sections: [
      {
        id: 's-hoc-phan',
        title: 'Hoãn thi kết thúc học phần',
        main: true,
        hint: 'Mỗi dòng là một học phần bạn xin hoãn thi.',
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
                            { type: 'text', text: 'Có xác nhận của cơ quan (nếu đi công tác) và ' },
                            { type: 'text', text: 'giấy tờ minh chứng (bắt buộc)', marks: [{ type: 'bold' }] },
                            { type: 'text', text: ', vd: quyết định cử đi công tác, giấy xác nhận của bệnh viện từ tuyến cấp huyện hoặc tương đương trở lên.' },
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
                            { type: 'text', text: 'Nộp đơn trước khi thi kết thúc học phần theo kế hoạch, ' },
                            { type: 'text', text: 'tối thiểu trước 07 ngày làm việc', marks: [{ type: 'bold' }] },
                            { type: 'text', text: ' tính đến ngày thi.' },
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
          { id: 'nam-hoc', type: 'text', label: 'Năm học', required: true, placeholder: 'VD: 2026 - 2027' },
          {
            id: 'hoc-phan',
            type: 'table',
            label: 'Các học phần xin hoãn thi',
            required: true,
            help: 'Ghi đầy đủ tên học phần.',
            columns: [
              { type: 'text', label: 'Tên học phần', placeholder: 'VD: Luật Hình sự phần chung' },
              { type: 'text', label: 'Lớp dự thi', placeholder: 'Lớp học phần' },
              { type: 'text', label: 'Thời gian thi', placeholder: 'VD: 7h30' },
              { type: 'date', label: 'Ngày thi' },
            ],
            rowName: 'học phần',
          },
        ],
      },
      {
        id: 's-li-do',
        title: 'Lí do đề nghị',
        main: false,
        questions: [
          {
            id: 'truong-hop',
            type: 'radio',
            label: 'Tôi là sinh viên thuộc trường hợp',
            required: true,
            options: ['Được cơ quan, tổ chức quyết định cử đi công tác', 'Vì lí do sức khỏe không thể tham dự lịch thi kết thúc học phần', 'Lí do khác'],
          },
          { id: 'li-do-khac', type: 'para', label: 'Lí do khác', required: false, help: 'Ghi rõ nếu chọn Lí do khác.' },
          { id: 'minh-chung', type: 'file', label: 'Giấy tờ minh chứng', required: true, maxMB: 5, accept: ['pdf', 'jpg', 'png'] },
        ],
      },
    ],
  },

  // 8. Mẫu số 3.2: Đơn phản ánh điểm đánh giá bộ phận
  {
    id: 'padbp',
    name: 'Phản ánh điểm đánh giá bộ phận',
    prefix: 'PADBP',
    description: 'Phản ánh điểm đánh giá bộ phận (điểm quá trình) trên Cổng đào tạo khác với điểm giảng viên công bố tại lớp',
    status: 'draft',
    sections: [
      {
        id: 's-hoc-phan',
        title: 'Học phần phản ánh điểm',
        main: true,
        questions: [
          { id: 'hoc-ky', type: 'radio', label: 'Học kỳ', required: true, options: ['Học kỳ 1', 'Học kỳ 2'] },
          { id: 'nam-hoc', type: 'text', label: 'Năm học', required: true, placeholder: 'VD: 2026 - 2027' },
          { id: 'ten-hoc-phan', type: 'text', label: 'Tên học phần', required: true, help: 'Ghi đúng và đủ tên học phần.' },
          {
            id: 'giang-vien',
            type: 'text',
            label: 'Giảng viên phụ trách giảng dạy, khoa giảng dạy',
            required: true,
            placeholder: 'VD: Nguyễn Văn A, Khoa Luật Hình sự',
          },
          { id: 'lop-hoc-phan', type: 'text', label: 'Lớp học phần đã đăng ký', required: true },
          { id: 'ngay-cong-bo', type: 'date', label: 'Ngày công bố điểm học phần', required: true },
          { id: 'diem-cong', type: 'number', label: 'Điểm đánh giá bộ phận công bố trên Cổng đào tạo', required: true, help: 'Thang điểm 10.' },
          { id: 'diem-tai-lop', type: 'number', label: 'Điểm đánh giá bộ phận giảng viên công bố tại lớp', required: true, help: 'Thang điểm 10.' },
        ],
      },
      {
        id: 's-li-do',
        title: 'Lí do phản ánh',
        main: false,
        questions: [
          { id: 'li-do', type: 'para', label: 'Lí do phản ánh', required: true },
          { id: 'minh-chung', type: 'file', label: 'Giấy tờ minh chứng', required: true, maxMB: 5, accept: ['pdf', 'jpg', 'png'] },
        ],
      },
    ],
  },

  // 9. Mẫu số 3.3/ĐNPADDTKTHP: Đơn phản ánh điểm thi kết thúc học phần
  {
    id: 'padt',
    name: 'Phản ánh điểm thi kết thúc học phần',
    prefix: 'PADT',
    description: 'Phản ánh khi có dự thi nhưng không có điểm, hoặc điểm khác điểm giảng viên công bố tại buổi thi (vấn đáp, giáo dục thể chất)',
    status: 'draft',
    sections: [
      {
        id: 's-hoc-phan',
        title: 'Học phần phản ánh điểm',
        main: true,
        questions: [
          {
            id: 'info-luu-y',
            type: 'info',
            color: 'blue',
            content: {
              type: 'doc',
              content: [
                {
                  type: 'paragraph',
                  content: [
                    {
                      type: 'text',
                      text: 'Áp dụng cho sinh viên có dự thi nhưng không có điểm, hoặc điểm khác với điểm giảng viên chấm thi công bố tại buổi thi đối với môn thi vấn đáp, giáo dục thể chất.',
                    },
                  ],
                },
              ],
            },
          },
          { id: 'hoc-ky', type: 'radio', label: 'Học kỳ', required: true, options: ['Học kỳ 1', 'Học kỳ 2'] },
          { id: 'nam-hoc', type: 'text', label: 'Năm học', required: true, placeholder: 'VD: 2026 - 2027' },
          { id: 'ten-hoc-phan', type: 'text', label: 'Tên học phần', required: true, help: 'Ghi đúng và đủ tên học phần.' },
          { id: 'lop-hoc-phan', type: 'text', label: 'Lớp học phần đã đăng ký thi', required: true },
          { id: 'ngay-thi', type: 'date', label: 'Ngày thi kết thúc học phần', required: true },
          { id: 'ngay-cong-bo', type: 'date', label: 'Ngày công bố điểm thi', required: true },
          { id: 'diem-cong', type: 'number', label: 'Điểm thi công bố trên Cổng đào tạo', required: false, help: 'Thang điểm 10. Bỏ trống nếu không có điểm.' },
          {
            id: 'diem-giang-vien',
            type: 'number',
            label: 'Điểm giảng viên chấm thi công bố tại buổi thi',
            required: false,
            help: 'Môn thi vấn đáp, giáo dục thể chất (nếu có). Thang điểm 10.',
          },
          { id: 'co-du-thi', type: 'check', label: 'Xác nhận', required: true, options: ['Tôi có tham dự thi kết thúc học phần'] },
        ],
      },
      {
        id: 's-li-do',
        title: 'Lí do phản ánh',
        main: false,
        questions: [
          { id: 'li-do', type: 'para', label: 'Lí do phản ánh', required: true },
          { id: 'minh-chung', type: 'file', label: 'Giấy tờ minh chứng', required: false, maxMB: 5, accept: ['pdf', 'jpg', 'png'] },
        ],
      },
    ],
  },

  // 10. Mẫu số 4.1/ĐNTHHHP: Đơn đề nghị tạm hoãn học học phần
  {
    id: 'thhp',
    name: 'Tạm hoãn học học phần',
    prefix: 'THHP',
    description: 'Tạm hoãn học các học phần đã đăng ký trong học kỳ',
    status: 'draft',
    sections: [
      {
        id: 's-hoc-phan',
        title: 'Tạm hoãn học học phần',
        main: true,
        hint: 'Mỗi dòng là một học phần bạn xin tạm hoãn học.',
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
                            { type: 'text', text: 'Có xác nhận của cơ quan (nếu đi công tác) và ' },
                            { type: 'text', text: 'giấy tờ minh chứng (bắt buộc)', marks: [{ type: 'bold' }] },
                            { type: 'text', text: ', vd: quyết định cử đi công tác, giấy xác nhận của bệnh viện, cơ sở, đơn vị có thẩm quyền.' },
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
                            { type: 'text', text: 'Nộp đơn trước khi học phần được tổ chức giảng dạy theo kế hoạch, ' },
                            { type: 'text', text: 'tối thiểu trước 05 ngày làm việc', marks: [{ type: 'bold' }] },
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
                          content: [{ type: 'text', text: 'Sau 10 ngày làm việc (tính từ ngày nộp đơn), liên hệ Phòng Đào tạo Đại học để nhận kết quả.' }],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          },
          { id: 'hoc-ky', type: 'radio', label: 'Học kỳ', required: true, options: ['Học kỳ 1', 'Học kỳ 2'] },
          { id: 'nam-hoc', type: 'text', label: 'Năm học', required: true, placeholder: 'VD: 2026 - 2027' },
          {
            id: 'hoc-phan',
            type: 'table',
            label: 'Các học phần xin tạm hoãn học',
            required: true,
            help: 'Ghi đầy đủ tên học phần.',
            columns: [
              { type: 'text', label: 'Tên học phần', placeholder: 'VD: Luật Hình sự phần chung' },
              { type: 'number', label: 'Số tín chỉ', sum: true, sumLabel: 'tín chỉ', placeholder: 'TC' },
              { type: 'text', label: 'Lớp đăng ký', placeholder: 'Lớp học phần' },
              { type: 'date', label: 'Học từ ngày' },
              { type: 'date', label: 'Học đến ngày' },
            ],
            rowName: 'học phần',
          },
        ],
      },
      {
        id: 's-li-do',
        title: 'Lí do đề nghị',
        main: false,
        questions: [
          { id: 'li-do', type: 'para', label: 'Lí do đề nghị', required: true },
          { id: 'minh-chung', type: 'file', label: 'Giấy tờ minh chứng', required: true, maxMB: 5, accept: ['pdf', 'jpg', 'png'] },
        ],
      },
    ],
  },

  // 11. Mẫu số 4.2: Đơn đề nghị nghỉ học tạm thời và bảo lưu kết quả học tập
  {
    id: 'blkq',
    name: 'Nghỉ học tạm thời, bảo lưu kết quả học tập',
    prefix: 'BLKQ',
    description: 'Nghỉ học tạm thời 01 năm và bảo lưu kết quả học tập',
    status: 'draft',
    sections: [
      {
        id: 's-thoi-gian',
        title: 'Thời gian nghỉ học tạm thời',
        main: true,
        questions: [
          {
            id: 'info-luu-y',
            type: 'info',
            color: 'blue',
            content: {
              type: 'doc',
              content: [
                {
                  type: 'paragraph',
                  content: [
                    { type: 'text', text: 'Nghỉ học tạm thời ' },
                    { type: 'text', text: '01 năm', marks: [{ type: 'bold' }] },
                    { type: 'text', text: ' và bảo lưu kết quả học tập.' },
                  ],
                },
                {
                  type: 'bulletList',
                  content: [
                    {
                      type: 'listItem',
                      content: [
                        {
                          type: 'paragraph',
                          content: [
                            { type: 'text', text: 'Điền đầy đủ thông tin, có xác nhận của cơ quan, đơn vị (nếu được điều động, cử đi công tác) và ' },
                            { type: 'text', text: 'giấy tờ minh chứng (bắt buộc)', marks: [{ type: 'bold' }] },
                            { type: 'text', text: ', vd: quyết định điều động, cử đi công tác, giấy xác nhận của bệnh viện, cơ sở, đơn vị có thẩm quyền.' },
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
                            { type: 'text', text: 'Nộp đơn ' },
                            { type: 'text', text: 'tối thiểu trước 10 ngày làm việc', marks: [{ type: 'bold' }] },
                            { type: 'text', text: ' trước khi bắt đầu học kỳ.' },
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
                              text: 'Sau 10 ngày làm việc (tính từ ngày bắt đầu kế hoạch giảng dạy của học kỳ), nhận kết quả tại Phòng Đào tạo Đại học (A.102) sau khi được báo qua email.',
                            },
                          ],
                        },
                      ],
                    },
                    {
                      type: 'listItem',
                      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Liên hệ: (028) 39400.989 - nhánh 112; email: dtdh@hcmulaw.edu.vn.' }] }],
                    },
                  ],
                },
              ],
            },
          },
          { id: 'tu-hoc-ky', type: 'radio', label: 'Nghỉ từ học kỳ', required: true, options: ['Học kỳ 1', 'Học kỳ 2'] },
          { id: 'tu-nam-hoc', type: 'text', label: 'Năm học bắt đầu nghỉ', required: true, placeholder: 'VD: 2026 - 2027' },
          { id: 'den-hoc-ky', type: 'radio', label: 'Đến hết học kỳ', required: true, options: ['Học kỳ 1', 'Học kỳ 2'] },
          { id: 'den-nam-hoc', type: 'text', label: 'Năm học kết thúc nghỉ', required: true, placeholder: 'VD: 2026 - 2027' },
        ],
      },
      {
        id: 's-li-do',
        title: 'Lí do đề nghị',
        main: false,
        questions: [
          {
            id: 'truong-hop',
            type: 'radio',
            label: 'Tôi là sinh viên thuộc trường hợp',
            required: true,
            options: [
              'Được điều động vào lực lượng vũ trang (kèm quyết định điều động)',
              'Được cơ quan có thẩm quyền điều động, đại diện quốc gia tham dự các kỳ thi, giải đấu quốc tế (kèm quyết định điều động, cử tham dự)',
              'Bị ốm, thai sản hoặc tai nạn phải điều trị thời gian dài (kèm giấy xác nhận của bệnh viện từ tuyến cấp huyện hoặc tương đương trở lên)',
              'Được đơn vị sử dụng lao động cử đi công tác hoặc học tập quá 6 tháng ở ngoài Thành phố Hồ Chí Minh (kèm quyết định cử đi công tác)',
              'Vì lí do cá nhân khác, theo nguyện vọng cá nhân',
            ],
          },
          { id: 'li-do', type: 'para', label: 'Trình bày lí do', required: false },
          {
            id: 'minh-chung',
            type: 'file',
            label: 'Giấy tờ minh chứng',
            required: true,
            help: 'Bắt buộc, trừ trường hợp lí do cá nhân.',
            maxMB: 5,
            accept: ['pdf', 'jpg', 'png'],
          },
        ],
      },
    ],
  },

  // 12. Mẫu số 4.3/ĐĐNTTH: Đơn đề nghị tiếp tục học
  {
    id: 'tth',
    name: 'Tiếp tục học',
    prefix: 'TTH',
    description: 'Tiếp tục học sau thời gian nghỉ học tạm thời, bảo lưu kết quả học tập',
    status: 'draft',
    sections: [
      {
        id: 's-tiep-tuc',
        title: 'Tiếp tục học',
        main: true,
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
                            { type: 'text', text: 'Điền đầy đủ thông tin, có xác nhận của cơ quan, đơn vị (nếu được điều động, cử đi công tác) và ' },
                            { type: 'text', text: 'giấy tờ minh chứng (bắt buộc)', marks: [{ type: 'bold' }] },
                            { type: 'text', text: ', vd: quyết định điều động, cử đi công tác, giấy xác nhận của bệnh viện, cơ sở, đơn vị có thẩm quyền.' },
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
                            { type: 'text', text: 'Nộp đơn ' },
                            { type: 'text', text: 'tối thiểu trước 10 ngày làm việc', marks: [{ type: 'bold' }] },
                            { type: 'text', text: ' trước khi bắt đầu học kỳ.' },
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
                              text: 'Sau 10 ngày làm việc (tính từ ngày bắt đầu kế hoạch giảng dạy của học kỳ), nhận kết quả tại Phòng Đào tạo Đại học (A.102) sau khi được báo qua email.',
                            },
                          ],
                        },
                      ],
                    },
                    {
                      type: 'listItem',
                      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Liên hệ: (028) 39400.989 - nhánh 112; email: dtdh@hcmulaw.edu.vn.' }] }],
                    },
                  ],
                },
              ],
            },
          },
          { id: 'hoc-ky', type: 'radio', label: 'Xin tiếp tục học từ học kỳ', required: true, options: ['Học kỳ 1', 'Học kỳ 2'] },
          { id: 'nam-hoc', type: 'text', label: 'Năm học', required: true, placeholder: 'VD: 2026 - 2027' },
        ],
      },
      {
        id: 's-da-nghi',
        title: 'Thời gian đã nghỉ học tạm thời',
        main: false,
        hint: 'Theo quyết định của Hiệu trưởng cho nghỉ học tạm thời 01 năm.',
        questions: [
          { id: 'tu-hoc-ky', type: 'radio', label: 'Nghỉ từ học kỳ', required: true, options: ['Học kỳ 1', 'Học kỳ 2'] },
          { id: 'tu-nam-hoc', type: 'text', label: 'Năm học bắt đầu nghỉ', required: true, placeholder: 'VD: 2026 - 2027' },
          { id: 'den-hoc-ky', type: 'radio', label: 'Đến hết học kỳ', required: true, options: ['Học kỳ 1', 'Học kỳ 2'] },
          { id: 'den-nam-hoc', type: 'text', label: 'Năm học kết thúc nghỉ', required: true, placeholder: 'VD: 2026 - 2027' },
          { id: 'so-quyet-dinh', type: 'text', label: 'Số quyết định cho nghỉ học tạm thời', required: true, placeholder: 'VD: 123/QĐ-ĐHL' },
          { id: 'ngay-quyet-dinh', type: 'date', label: 'Ngày quyết định', required: true },
        ],
      },
      {
        id: 's-li-do',
        title: 'Lí do và cam kết',
        main: false,
        questions: [
          {
            id: 'truong-hop',
            type: 'check',
            label: 'Nay tôi đã',
            required: true,
            options: [
              'Hoàn thành nhiệm vụ, công tác điều động vào lực lượng vũ trang',
              'Hoàn thành nhiệm vụ, công tác điều động đại diện quốc gia tham dự các kỳ thi, giải đấu quốc tế',
              'Sức khỏe đã bình phục do bị ốm hoặc tai nạn phải điều trị thời gian dài',
              'Hết thời gian nghỉ hưởng chế độ thai sản',
              'Hoàn thành công tác hoặc học tập quá 6 tháng ở ngoài Thành phố Hồ Chí Minh do đơn vị sử dụng lao động cử đi',
              'Cải thiện điểm số học phần chưa đạt',
              'Khắc phục hoàn cảnh khó khăn',
              'Hết thời hạn kỷ luật',
              'Lí do khác',
            ],
          },
          { id: 'li-do-khac', type: 'para', label: 'Lí do khác', required: false, help: 'Ghi rõ nếu chọn Lí do khác.' },
          {
            id: 'minh-chung',
            type: 'file',
            label: 'Giấy tờ minh chứng',
            required: false,
            help: 'Quyết định cho nghỉ học tạm thời và giấy tờ liên quan.',
            maxMB: 5,
            accept: ['pdf', 'jpg', 'png'],
          },
          {
            id: 'cam-ket',
            type: 'check',
            label: 'Cam kết',
            required: true,
            options: ['Tôi xin hứa sẽ thực hiện đầy đủ các quy định của Trường trong suốt thời gian theo học.'],
          },
        ],
      },
    ],
  },

  // 13. Mẫu số 4.4/ĐNTH: Đơn đề nghị thôi học
  {
    id: 'th',
    name: 'Thôi học',
    prefix: 'TH',
    description: 'Thôi học tại Trường Đại học Luật Thành phố Hồ Chí Minh',
    status: 'draft',
    sections: [
      {
        id: 's-thoi-hoc',
        title: 'Thôi học',
        main: true,
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
                            { type: 'text', text: 'Điền đầy đủ thông tin, có xác nhận của cơ quan, đơn vị (nếu được điều động, cử đi công tác) và ' },
                            { type: 'text', text: 'giấy tờ minh chứng (bắt buộc)', marks: [{ type: 'bold' }] },
                            { type: 'text', text: ', vd: quyết định điều động, cử đi công tác, giấy xác nhận của bệnh viện, cơ sở, đơn vị có thẩm quyền.' },
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
                            { type: 'text', text: 'Nộp đơn ' },
                            { type: 'text', text: 'tối thiểu trước 10 ngày làm việc', marks: [{ type: 'bold' }] },
                            { type: 'text', text: ' trước khi bắt đầu học kỳ.' },
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
                              text: 'Sau 10 ngày làm việc (tính từ ngày bắt đầu kế hoạch giảng dạy của học kỳ), nhận kết quả tại Phòng Đào tạo Đại học (A.102) sau khi được báo qua email.',
                            },
                          ],
                        },
                      ],
                    },
                    {
                      type: 'listItem',
                      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Liên hệ: (028) 39400.989 - nhánh 112; email: dtdh@hcmulaw.edu.vn.' }] }],
                    },
                  ],
                },
              ],
            },
          },
          { id: 'ngay-thoi-hoc', type: 'date', label: 'Thôi học kể từ ngày', required: true },
          { id: 'hoc-ky', type: 'radio', label: 'Học kỳ', required: true, options: ['Học kỳ 1', 'Học kỳ 2'] },
          { id: 'nam-hoc', type: 'text', label: 'Năm học', required: true, placeholder: 'VD: 2026 - 2027' },
        ],
      },
      {
        id: 's-li-do',
        title: 'Lí do và cam kết',
        main: false,
        questions: [
          { id: 'li-do', type: 'para', label: 'Lí do đề nghị', required: true },
          { id: 'minh-chung', type: 'file', label: 'Giấy tờ minh chứng', required: true, maxMB: 5, accept: ['pdf', 'jpg', 'png'] },
          { id: 'cam-ket', type: 'check', label: 'Cam kết', required: true, options: ['Tôi cam kết thực hiện đầy đủ các nghĩa vụ theo quy định của Trường.'] },
        ],
      },
    ],
  },

  // 14. Mẫu số 5.1/ĐNCT: Đơn đề nghị chuyển ngành đào tạo
  {
    id: 'cn',
    name: 'Chuyển ngành đào tạo',
    prefix: 'CN',
    description: 'Chuyển sang ngành đào tạo khác của Trường',
    status: 'draft',
    sections: [
      {
        id: 's-nguyen-vong',
        title: 'Ngành xin chuyển',
        main: true,
        questions: [
          { id: 'hoc-ky', type: 'radio', label: 'Chuyển ngành kể từ học kỳ', required: true, options: ['Học kỳ 1', 'Học kỳ 2'] },
          { id: 'nam-hoc', type: 'text', label: 'Năm học', required: true, placeholder: 'VD: 2026 - 2027' },
          { id: 'nganh-moi', type: 'text', label: 'Ngành học xin chuyển sang', required: true },
          { id: 'ctdt-moi', type: 'text', label: 'Chương trình đào tạo', required: false },
          { id: 'diem-nganh-moi', type: 'number', label: 'Điểm trúng tuyển của ngành mới cùng năm tuyển sinh mà bạn đạt được', required: true },
          { id: 'to-hop-nganh-moi', type: 'text', label: 'Tổ hợp xét tuyển của ngành mới', required: true },
        ],
      },
      {
        id: 's-tuyen-sinh',
        title: 'Tuyển sinh, kết quả học tập',
        main: false,
        questions: [
          { id: 'nam-thu', type: 'number', label: 'Đang học năm thứ', required: true },
          { id: 'phuong-thuc', type: 'text', label: 'Phương thức tuyển sinh đã trúng tuyển vào trường đang học', required: true },
          { id: 'diem-tuyen-sinh', type: 'number', label: 'Điểm tuyển sinh đạt được', required: true, help: 'Không tính điểm ưu tiên.' },
          { id: 'to-hop', type: 'text', label: 'Tổ hợp xét tuyển', required: true, placeholder: 'VD: C00' },
          { id: 'doi-tuong', type: 'text', label: 'Đối tượng tuyển sinh', required: false, help: 'Ghi rõ mã quy ước.' },
          { id: 'khu-vuc', type: 'text', label: 'Khu vực', required: true, placeholder: 'VD: KV2' },
          { id: 'diem-tich-luy', type: 'text', label: 'Điểm tích lũy (thang 4)', required: true, help: 'Ghi rõ năm thứ mấy.', placeholder: 'VD: Năm thứ 2: 3,2/4' },
          {
            id: 'ket-qua-cac-nam',
            type: 'para',
            label: 'Kết quả học tập, rèn luyện qua các năm học',
            required: true,
            help: 'Ghi rõ từng năm học: phân loại, xếp hạng học tập, rèn luyện, khen thưởng hoặc kỷ luật (nếu có).',
          },
        ],
      },
      {
        id: 's-li-do',
        title: 'Lí do đề nghị',
        main: false,
        questions: [
          { id: 'li-do', type: 'para', label: 'Lí do xin chuyển ngành', required: true },
          { id: 'minh-chung', type: 'file', label: 'Giấy tờ minh chứng', required: false, maxMB: 5, accept: ['pdf', 'jpg', 'png'] },
        ],
      },
    ],
  },

  // 15. Mẫu số 5.2/ĐNCCTĐT: Đơn đề nghị chuyển chương trình đào tạo
  {
    id: 'cct',
    name: 'Chuyển chương trình đào tạo',
    prefix: 'CCT',
    description: 'Chuyển giữa chương trình đào tạo chuẩn và chương trình đào tạo chất lượng cao',
    status: 'draft',
    sections: [
      {
        id: 's-chuyen',
        title: 'Chuyển chương trình đào tạo',
        main: true,
        questions: [
          {
            id: 'info-luu-y',
            type: 'info',
            color: 'blue',
            content: {
              type: 'doc',
              content: [
                {
                  type: 'paragraph',
                  content: [
                    { type: 'text', text: 'Chuyển từ chương trình chuẩn sang chương trình chất lượng cao phải ' },
                    { type: 'text', text: 'nộp kèm bản chụp chứng chỉ ngoại ngữ', marks: [{ type: 'bold' }] },
                    { type: 'text', text: ' theo quy định.' },
                  ],
                },
              ],
            },
          },
          {
            id: 'chuyen',
            type: 'radio',
            label: 'Chuyển chương trình đào tạo',
            required: true,
            options: ['Từ chương trình chuẩn sang chương trình chất lượng cao', 'Từ chương trình chất lượng cao sang chương trình chuẩn'],
          },
        ],
      },
      {
        id: 's-li-do',
        title: 'Lí do đề nghị',
        main: false,
        questions: [
          { id: 'li-do', type: 'para', label: 'Lí do đề nghị', required: true },
          {
            id: 'minh-chung',
            type: 'file',
            label: 'Giấy tờ minh chứng',
            required: true,
            help: 'Chứng chỉ ngoại ngữ hoặc giấy cam kết',
            maxMB: 5,
            accept: ['pdf', 'jpg', 'png'],
          },
        ],
      },
    ],
  },

  // 16. Mẫu số 5.3/ĐNCHTĐT: Đơn đề nghị chuyển hình thức đào tạo
  {
    id: 'cht',
    name: 'Chuyển hình thức đào tạo',
    prefix: 'CHT',
    description: 'Chuyển hình thức đào tạo khi quá thời hạn hoàn thành khóa học, hoặc chưa đạt chuẩn ngoại ngữ của chương trình đại trà',
    status: 'draft',
    sections: [
      {
        id: 's-chuyen',
        title: 'Chuyển hình thức đào tạo',
        main: true,
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
                            {
                              type: 'text',
                              text: 'Dành cho sinh viên quá thời hạn tối đa hoàn thành khóa học, chưa tích lũy đủ tín chỉ, học phần theo chương trình đào tạo, hoặc không đạt chuẩn ngoại ngữ, có nguyện vọng nhận bằng tốt nghiệp theo hình thức đào tạo khác.',
                            },
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
                            { type: 'text', text: 'Không đạt chuẩn đầu ra của chương trình đại trà nhưng đạt chuẩn của hình thức vừa làm vừa học, từ xa: ' },
                            { type: 'text', text: 'nộp kèm bản chụp phiếu điểm, chứng chỉ ngoại ngữ', marks: [{ type: 'bold' }] },
                            { type: 'text', text: ' (mang bản chính để đối chiếu).' },
                          ],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          },
          { id: 'hinh-thuc-moi', type: 'radio', label: 'Chuyển sang hình thức đào tạo', required: true, options: ['Vừa làm vừa học', 'Từ xa'] },
        ],
      },
      {
        id: 's-li-do',
        title: 'Lí do đề nghị',
        main: false,
        questions: [
          { id: 'hoc-ky', type: 'radio', label: 'Tính đến học kỳ', required: true, options: ['Học kỳ 1', 'Học kỳ 2'] },
          { id: 'nam-hoc', type: 'text', label: 'Năm học', required: true, placeholder: 'VD: 2026 - 2027' },
          {
            id: 'truong-hop',
            type: 'check',
            label: 'Hiện tôi thuộc trường hợp',
            required: true,
            options: [
              'Quá thời hạn tối đa hoàn thành khóa học theo Quy chế đào tạo, chưa tích lũy đủ số tín chỉ, học phần theo chương trình đào tạo',
              'Chưa đạt chuẩn đầu ra ngoại ngữ của chương trình đại trà (chuẩn), nhưng đã đạt chuẩn tiếng Anh của hình thức đào tạo xin chuyển sang',
              'Lí do khác',
            ],
          },
          { id: 'hp-chua-tich-luy', type: 'number', label: 'Số học phần chưa tích lũy', required: true },
          { id: 'tc-da-tich-luy', type: 'number', label: 'Số tín chỉ đã tích lũy', required: true },
          { id: 'chung-chi', type: 'text', label: 'Chứng chỉ tiếng Anh đạt được', required: false, placeholder: 'VD: TOEIC 500/990, TOEFL iBT 61/120, IELTS 5.0/9.0' },
          { id: 'li-do-khac', type: 'para', label: 'Lí do khác', required: false, help: 'Ghi rõ nếu chọn Lí do khác.' },
          { id: 'minh-chung', type: 'file', label: 'Giấy tờ minh chứng', required: false, maxMB: 5, accept: ['pdf', 'jpg', 'png'] },
        ],
      },
    ],
  },

  // 17. Mẫu số 5.4/ĐNCT: Đơn đề nghị chuyển trường
  {
    id: 'ctr',
    name: 'Chuyển trường',
    prefix: 'CTR',
    description: 'Dành cho sinh viên cơ sở đào tạo khác muốn chuyển đến học tại Trường Đại học Luật Thành phố Hồ Chí Minh',
    status: 'draft',
    sections: [
      {
        id: 's-nguyen-vong',
        title: 'Nguyện vọng chuyển trường',
        main: true,
        questions: [
          {
            id: 'info-luu-y',
            type: 'info',
            color: 'blue',
            content: {
              type: 'doc',
              content: [
                {
                  type: 'paragraph',
                  content: [
                    {
                      type: 'text',
                      text: 'Dành cho sinh viên của các cơ sở đào tạo khác có nguyện vọng chuyển đến học tại Trường Đại học Luật Thành phố Hồ Chí Minh.',
                    },
                  ],
                },
                {
                  type: 'bulletList',
                  content: [
                    { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Bằng tốt nghiệp THPT (bản sao).' }] }] },
                    {
                      type: 'listItem',
                      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Giấy chứng nhận kết quả thi tốt nghiệp THPT (bản chính).' }] }],
                    },
                    {
                      type: 'listItem',
                      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Bảng điểm của cơ sở đào tạo đang theo học (bản sao).' }] }],
                    },
                    { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Giấy khai sinh (bản sao).' }] }] },
                    {
                      type: 'listItem',
                      content: [
                        {
                          type: 'paragraph',
                          content: [
                            {
                              type: 'text',
                              text: 'Giấy tờ chứng minh lí do chuyển trường: giấy xác nhận thông tin cư trú (hoặc căn cước công dân, thẻ căn cước, giấy thông báo số định danh cá nhân), hoặc giấy xác nhận hoàn cảnh gia đình khó khăn (bản sao).',
                            },
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
                              text: 'Giấy báo trúng tuyển (bản sao); giấy xác nhận quá trình học tập, rèn luyện, có xác nhận không đang bị xem xét buộc thôi học hoặc kỷ luật (bản chính hoặc bản sao có chứng thực).',
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
          { id: 'truong-dang-hoc', type: 'text', label: 'Trường đang học', required: true },
          { id: 'noi-thuong-tru', type: 'text', label: 'Nơi thường trú trước khi chuyển trường', required: true },
          { id: 'vao-nam-thu', type: 'number', label: 'Xin chuyển đến học năm thứ', required: true },
          { id: 'nganh-xin-hoc', type: 'text', label: 'Ngành học xin chuyển đến', required: true },
        ],
      },
      {
        id: 's-tuyen-sinh',
        title: 'Tuyển sinh, kết quả học tập',
        main: false,
        questions: [
          { id: 'nam-thu', type: 'number', label: 'Đang học năm thứ', required: true },
          { id: 'phuong-thuc', type: 'text', label: 'Phương thức tuyển sinh đã trúng tuyển vào trường đang học', required: true },
          { id: 'diem-tuyen-sinh', type: 'number', label: 'Điểm tuyển sinh đạt được', required: true, help: 'Không tính điểm ưu tiên.' },
          { id: 'to-hop', type: 'text', label: 'Tổ hợp xét tuyển', required: true, placeholder: 'VD: C00' },
          { id: 'doi-tuong', type: 'text', label: 'Đối tượng tuyển sinh', required: false, help: 'Ghi rõ mã quy ước.' },
          { id: 'khu-vuc', type: 'text', label: 'Khu vực', required: true, placeholder: 'VD: KV2' },
          {
            id: 'diem-tich-luy',
            type: 'text',
            label: 'Điểm tích lũy',
            required: true,
            help: 'Ghi điểm đạt được / điểm xét tuyển cần đạt theo quy định.', placeholder: 'VD: Năm thứ 1: 24 / 22',
          },
          {
            id: 'ket-qua-cac-nam',
            type: 'para',
            label: 'Kết quả học tập, rèn luyện qua các năm học',
            required: true,
            help: 'Ghi rõ từng năm học: phân loại, xếp hạng học tập, rèn luyện, khen thưởng hoặc kỷ luật (nếu có).',
          },
        ],
      },
      {
        id: 's-li-do',
        title: 'Lí do đề nghị',
        main: false,
        questions: [
          { id: 'li-do', type: 'para', label: 'Lí do xin chuyển trường', required: true },
          {
            id: 'minh-chung',
            type: 'file',
            label: 'Hồ sơ kèm theo',
            required: true,
            help: 'Các giấy tờ nêu ở phần lưu ý.',
            maxMB: 5,
            accept: ['pdf', 'jpg', 'png'],
          },
        ],
      },
    ],
  },

  // 18. Mẫu số 6.1/ĐNXMHP(T): Đơn đề nghị xét miễn học học phần, công nhận kết quả, chuyển đổi tín chỉ đã tích lũy
  {
    id: 'xmt',
    name: 'Xét miễn học phần, công nhận kết quả (đã tốt nghiệp tại Trường)',
    prefix: 'XMT',
    description: 'Xét miễn học học phần, công nhận kết quả học tập và chuyển đổi tín chỉ đã tích lũy, cho sinh viên đã tốt nghiệp đại học chính quy tại Trường',
    status: 'draft',
    sections: [
      {
        id: 's-hoc-phan',
        title: 'Học phần xin miễn',
        main: true,
        hint: 'Mỗi dòng là một học phần bạn đã hoàn tất tại Trường.',
        questions: [
          {
            id: 'info-luu-y',
            type: 'info',
            color: 'blue',
            content: {
              type: 'doc',
              content: [
                {
                  type: 'paragraph',
                  content: [
                    {
                      type: 'text',
                      text: 'Chỉ áp dụng cho sinh viên đã học và tốt nghiệp trình độ đại học hình thức chính quy tại Trường Đại học Luật Thành phố Hồ Chí Minh.',
                    },
                  ],
                },
                {
                  type: 'bulletList',
                  content: [
                    {
                      type: 'listItem',
                      content: [
                        {
                          type: 'paragraph',
                          content: [
                            { type: 'text', text: 'Khối lượng tín chỉ đề nghị công nhận, chuyển đổi ' },
                            { type: 'text', text: 'không vượt quá 50%', marks: [{ type: 'bold' }] },
                            { type: 'text', text: ' khối lượng học tập tối thiểu của chương trình đào tạo đang học.' },
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
                            { type: 'text', text: 'Kết quả xét miễn ghi kèm ký hiệu ' },
                            { type: 'text', text: 'T', marks: [{ type: 'bold' }] },
                            { type: 'text', text: ', được tính vào điểm trung bình học kỳ, năm học và tích lũy toàn khóa.' },
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
                            { type: 'text', text: 'Nộp đơn trước khi học phần được tổ chức giảng dạy theo kế hoạch, ' },
                            { type: 'text', text: 'tối thiểu trước 10 ngày làm việc', marks: [{ type: 'bold' }] },
                            { type: 'text', text: '.' },
                          ],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          },
          {
            id: 'hoc-phan',
            type: 'table',
            label: 'Các học phần xin miễn học và thi, công nhận tín chỉ',
            required: true,
            columns: [
              { type: 'text', label: 'Môn học, học phần', placeholder: 'VD: Tin học đại cương' },
              { type: 'number', label: 'Số tín chỉ', sum: true, sumLabel: 'tín chỉ', placeholder: 'TC' },
              { type: 'number', label: 'Điểm học phần', placeholder: 'Thang 10' },
            ],
            rowName: 'học phần',
          },
        ],
      },
      {
        id: 's-minh-chung',
        title: 'Minh chứng',
        main: false,
        questions: [{ id: 'minh-chung', type: 'file', label: 'Bảng điểm học tập', required: true, maxMB: 5, accept: ['pdf', 'jpg', 'png'] }],
      },
    ],
  },

  // 19. Mẫu số 6.2/ĐNXMHP&CĐTC(R): Đơn đề nghị xét miễn học học phần và chuyển đổi tín chỉ (cơ sở đào tạo khác)
  {
    id: 'xmr',
    name: 'Xét miễn học phần, chuyển đổi tín chỉ (đã học ở cơ sở đào tạo khác)',
    prefix: 'XMR',
    description: 'Xét miễn học học phần và chuyển đổi tín chỉ cho học phần đã học ở cơ sở đào tạo khác',
    status: 'draft',
    sections: [
      {
        id: 's-hoc-phan',
        title: 'Học phần xin miễn',
        main: true,
        hint: 'Mỗi dòng là một học phần bạn xin miễn.',
        questions: [
          {
            id: 'info-luu-y',
            type: 'info',
            color: 'blue',
            content: {
              type: 'doc',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'Áp dụng cho các học phần trong chương trình đào tạo, đối với sinh viên đã học ở cơ sở đào tạo khác.' }],
                },
                {
                  type: 'bulletList',
                  content: [
                    {
                      type: 'listItem',
                      content: [
                        {
                          type: 'paragraph',
                          content: [
                            { type: 'text', text: 'Khối lượng tín chỉ đề nghị công nhận, chuyển đổi ' },
                            { type: 'text', text: 'không vượt quá 50%', marks: [{ type: 'bold' }] },
                            { type: 'text', text: ' khối lượng học tập tối thiểu của chương trình đào tạo đang học.' },
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
                            { type: 'text', text: 'Kết quả xét miễn ghi kèm ký hiệu ' },
                            { type: 'text', text: 'R', marks: [{ type: 'bold' }] },
                            { type: 'text', text: ', không tính vào điểm trung bình học kỳ, năm học và tích lũy toàn khóa.' },
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
                            { type: 'text', text: 'Nộp đơn trước khi học phần được tổ chức giảng dạy theo kế hoạch, ' },
                            { type: 'text', text: 'tối thiểu trước 05 ngày làm việc', marks: [{ type: 'bold' }] },
                            { type: 'text', text: '.' },
                          ],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          },
          {
            id: 'hoc-phan',
            type: 'table',
            label: 'Các học phần xin miễn học và thi, công nhận tín chỉ',
            required: true,
            columns: [
              { type: 'text', label: 'Học phần xin miễn', sub: 'Theo chương trình đào tạo của Trường', placeholder: 'VD: Luật Hiến pháp' },
              { type: 'number', label: 'Số tín chỉ', sum: true, sumLabel: 'tín chỉ', placeholder: 'TC' },
              { type: 'text', label: 'Học phần đã hoàn thành', sub: 'Tại cơ sở đào tạo khác, theo bảng điểm' },
              { type: 'text', label: 'Số tín chỉ, ĐVHT, số tiết', placeholder: 'VD: 3 TC' },
              { type: 'number', label: 'Điểm học phần', placeholder: 'Thang 10' },
            ],
            rowName: 'học phần',
          },
          { id: 'co-so-dao-tao', type: 'text', label: 'Cơ sở đào tạo đã hoàn tất các học phần trên', required: true },
          { id: 'hinh-thuc-dao-tao', type: 'text', label: 'Hình thức đào tạo tại cơ sở đó', required: true },
        ],
      },
      {
        id: 's-minh-chung',
        title: 'Minh chứng',
        main: false,
        questions: [
          {
            id: 'minh-chung',
            type: 'file',
            label: 'Bảng điểm học tập, chứng chỉ hoặc bằng tốt nghiệp',
            required: true,
            maxMB: 5,
            accept: ['pdf', 'jpg', 'png'],
          },
        ],
      },
    ],
  },

  // 20. Mẫu số 6.3/ĐNCĐ(CT): Đơn đề nghị xét chuyển điểm cho sinh viên chuyển trường
  {
    id: 'cdct',
    name: 'Xét chuyển điểm cho sinh viên chuyển trường',
    prefix: 'CDCT',
    description: 'Xét chuyển điểm, công nhận kết quả học tập và chuyển đổi tín chỉ đã tích lũy, cho sinh viên được chuyển trường',
    status: 'draft',
    sections: [
      {
        id: 's-hoc-phan',
        title: 'Học phần xin chuyển điểm',
        main: true,
        hint: 'Mỗi dòng là một học phần bạn xin chuyển điểm.',
        questions: [
          {
            id: 'info-luu-y',
            type: 'info',
            color: 'blue',
            content: {
              type: 'doc',
              content: [
                { type: 'paragraph', content: [{ type: 'text', text: 'Chỉ áp dụng cho sinh viên được chuyển trường theo quy định.' }] },
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
                            { type: 'text', text: 'tối thiểu trước 05 ngày làm việc', marks: [{ type: 'bold' }] },
                            { type: 'text', text: '.' },
                          ],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          },
          { id: 'truong-cu', type: 'text', label: 'Trường đã hoàn tất các học phần', required: true },
          {
            id: 'hoc-phan',
            type: 'table',
            label: 'Các học phần xin chuyển điểm',
            required: true,
            columns: [
              { type: 'text', label: 'Môn học, học phần', placeholder: 'VD: Tin học đại cương' },
              { type: 'number', label: 'Số tín chỉ', sum: true, sumLabel: 'tín chỉ', placeholder: 'TC' },
              { type: 'number', label: 'Điểm học phần', placeholder: 'Thang 10' },
            ],
            rowName: 'học phần',
          },
        ],
      },
      {
        id: 's-minh-chung',
        title: 'Minh chứng',
        main: false,
        questions: [{ id: 'minh-chung', type: 'file', label: 'Bảng điểm học tập', required: true, maxMB: 5, accept: ['pdf', 'jpg', 'png'] }],
      },
    ],
  },

  // 21. Mẫu số 6.4/ĐNXMHP(CC): Đơn đề nghị xét miễn học học phần (chứng chỉ tin học, GDQP-AN)
  {
    id: 'xmcc',
    name: 'Xét miễn học phần (chứng chỉ tin học, GDQP-AN)',
    prefix: 'XMCC',
    description: 'Xét miễn học học phần tin học đại cương, giáo dục quốc phòng an ninh khi đã có chứng chỉ',
    status: 'draft',
    sections: [
      {
        id: 's-hoc-phan',
        title: 'Học phần xin miễn',
        main: true,
        hint: 'Mỗi dòng là một học phần bạn xin miễn.',
        questions: [
          {
            id: 'info-luu-y',
            type: 'info',
            color: 'blue',
            content: {
              type: 'doc',
              content: [
                {
                  type: 'paragraph',
                  content: [
                    {
                      type: 'text',
                      text: 'Chỉ áp dụng cho sinh viên đã học và hoàn thành chứng chỉ đối với các học phần tin học đại cương, giáo dục quốc phòng an ninh.',
                    },
                  ],
                },
                {
                  type: 'bulletList',
                  content: [
                    {
                      type: 'listItem',
                      content: [
                        {
                          type: 'paragraph',
                          content: [
                            { type: 'text', text: 'Khối lượng tín chỉ đề nghị công nhận, chuyển đổi ' },
                            { type: 'text', text: 'không vượt quá 50%', marks: [{ type: 'bold' }] },
                            { type: 'text', text: ' khối lượng học tập tối thiểu của chương trình đào tạo đang học.' },
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
                            { type: 'text', text: 'Kết quả xét miễn ghi kèm ký hiệu ' },
                            { type: 'text', text: 'R', marks: [{ type: 'bold' }] },
                            { type: 'text', text: ', không tính vào điểm trung bình học kỳ, năm học và tích lũy toàn khóa.' },
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
                            { type: 'text', text: 'Nộp đơn trước khi học phần được tổ chức giảng dạy theo kế hoạch, ' },
                            { type: 'text', text: 'tối thiểu trước 10 ngày làm việc', marks: [{ type: 'bold' }] },
                            { type: 'text', text: '.' },
                          ],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          },
          {
            id: 'hoc-phan',
            type: 'table',
            label: 'Các học phần xin miễn học và thi',
            required: true,
            columns: [
              { type: 'text', label: 'Môn học, học phần', placeholder: 'VD: Tin học đại cương' },
              { type: 'number', label: 'Số tín chỉ', sum: true, sumLabel: 'tín chỉ', placeholder: 'TC' },
              { type: 'text', label: 'Điểm học phần, loại chứng chỉ', placeholder: 'VD: Giỏi' },
            ],
            rowName: 'học phần',
          },
        ],
      },
      {
        id: 's-minh-chung',
        title: 'Minh chứng',
        main: false,
        questions: [{ id: 'minh-chung', type: 'file', label: 'Bản chụp chứng chỉ', required: true, maxMB: 5, accept: ['pdf', 'jpg', 'png'] }],
      },
    ],
  },

  // 22. Mẫu số 7.1/ĐNKLKLTN: Đơn đề nghị không làm khóa luận tốt nghiệp
  {
    id: 'kkl',
    name: 'Không làm khóa luận tốt nghiệp',
    prefix: 'KKL',
    description: 'Không làm khóa luận tốt nghiệp, chuyển sang đi thực tập, báo cáo chuyên đề thực tiễn và học, thi các học phần kỹ năng, chuyên môn',
    status: 'draft',
    sections: [
      {
        id: 's-de-nghi',
        title: 'Không làm khóa luận tốt nghiệp',
        main: true,
        questions: [
          {
            id: 'info-luu-y',
            type: 'info',
            color: 'blue',
            content: {
              type: 'doc',
              content: [
                {
                  type: 'paragraph',
                  content: [
                    {
                      type: 'text',
                      text: 'Áp dụng cho sinh viên đủ điều kiện làm khóa luận tốt nghiệp (theo danh sách Trường công bố) nhưng không có nguyện vọng làm khóa luận.',
                    },
                  ],
                },
              ],
            },
          },
          { id: 'diem-tb', type: 'number', label: 'Điểm trung bình tích lũy toàn khóa (thang 4)', required: true, placeholder: 'VD: 3,25' },
          { id: 'hoc-ky', type: 'radio', label: 'Tính đến hết học kỳ', required: true, options: ['Học kỳ 1', 'Học kỳ 2'] },
          { id: 'nam-hoc', type: 'text', label: 'Năm học', required: true, placeholder: 'VD: 2026 - 2027' },
          { id: 'co-quan', type: 'text', label: 'Tên cơ quan, đơn vị đăng ký thực tập, làm việc, liên hệ thực tiễn', required: true },
          { id: 'dia-chi', type: 'text', label: 'Địa chỉ cơ quan, đơn vị', required: true },
        ],
      },
      {
        id: 's-cam-ket',
        title: 'Cam kết',
        main: false,
        questions: [
          {
            id: 'cam-ket',
            type: 'check',
            label: 'Cam kết',
            required: true,
            options: [
              'Tôi xin cam kết sẽ thực hiện đầy đủ và đúng các quy định liên quan đến việc đi thực tập, viết báo cáo chuyên đề thực tiễn; học và thi các học phần chuyên môn để đảm bảo đủ số tín chỉ theo quy định như đối với sinh viên được chọn làm khóa luận tốt nghiệp theo thông báo của Trường.',
            ],
          },
        ],
      },
    ],
  },

  // 23. Mẫu số 7.2/ĐNCGGTTT: Đơn đề nghị cấp lần 1, đổi lại Giấy giới thiệu thực tập
  {
    id: 'gttt',
    name: 'Cấp, đổi lại Giấy giới thiệu thực tập',
    prefix: 'GTTT',
    description: 'Cấp lần 1 hoặc cấp lại Giấy giới thiệu thực tập',
    status: 'draft',
    sections: [
      {
        id: 's-de-nghi',
        title: 'Giấy giới thiệu thực tập',
        main: true,
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
                            { type: 'text', text: 'Đề nghị cấp lại: ' },
                            { type: 'text', text: 'nộp kèm Giấy giới thiệu thực tập cũ', marks: [{ type: 'bold' }] },
                            { type: 'text', text: ' đã được cấp.' },
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
                              text: 'Muốn đổi nơi thực tập sau khi đã có xác nhận của cơ quan tiếp nhận: phải có xác nhận lại của cơ quan đó, đồng ý cho đổi nơi thực tập, có chữ ký và đóng dấu của người có thẩm quyền.',
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
          {
            id: 'truong-hop',
            type: 'radio',
            label: 'Đề nghị',
            required: true,
            options: ['Cấp lần 1 Giấy giới thiệu thực tập', 'Cấp lại Giấy giới thiệu thực tập'],
          },
          { id: 'lan-thu', type: 'number', label: 'Cấp lại lần thứ', required: false, help: 'Chỉ ghi khi đề nghị cấp lại.' },
          { id: 'co-quan', type: 'text', label: 'Tên cơ quan, đơn vị đăng ký thực tập', required: true },
          { id: 'dia-chi', type: 'text', label: 'Địa chỉ cơ quan, đơn vị', required: true },
          { id: 'tu-ngay', type: 'date', label: 'Thực tập từ ngày', required: true },
          { id: 'den-ngay', type: 'date', label: 'Thực tập đến ngày', required: true },
        ],
      },
      {
        id: 's-li-do',
        title: 'Lí do và cam kết',
        main: false,
        questions: [
          {
            id: 'li-do-chon',
            type: 'radio',
            label: 'Lí do đề nghị',
            required: true,
            options: [
              'Chưa đăng ký nơi thực tập theo kế hoạch, thông báo của Trường',
              'Đã liên hệ đơn vị thực tập theo Giấy giới thiệu, nhưng không được tiếp nhận',
              'Đã được tiếp nhận thực tập, nay muốn đổi sang đơn vị khác',
              'Làm mất Giấy giới thiệu cũ (có đơn cớ mất được cơ quan có thẩm quyền xác nhận)',
              'Lí do khác',
            ],
          },
          { id: 'li-do', type: 'para', label: 'Trình bày cụ thể', required: true },
          { id: 'minh-chung', type: 'file', label: 'Giấy tờ minh chứng', required: false, maxMB: 5, accept: ['pdf', 'jpg', 'png'] },
          {
            id: 'cam-ket',
            type: 'check',
            label: 'Cam kết',
            required: true,
            options: [
              'Tôi xin cam kết đảm bảo đúng thời gian đi thực tập theo kế hoạch, quy định, quy chế của Trường tại cơ quan, đơn vị đã nêu và chịu trách nhiệm về kết quả xác nhận, nhận xét của cơ quan, đơn vị thực tập.',
            ],
          },
        ],
      },
    ],
  },

  // 24. Mẫu số 8.1/ĐNXCNTT: Đơn đề nghị xét, công nhận tốt nghiệp và cấp bằng cử nhân
  {
    id: 'xtn',
    name: 'Xét, công nhận tốt nghiệp',
    prefix: 'XTN',
    description: 'Xét, công nhận tốt nghiệp và cấp bằng cử nhân, cho sinh viên đã được hoãn xét hoặc xét sau đợt chính khóa',
    status: 'draft',
    sections: [
      {
        id: 's-ket-qua',
        title: 'Kết quả học tập',
        main: true,
        questions: [
          {
            id: 'info-luu-y',
            type: 'info',
            color: 'blue',
            content: {
              type: 'doc',
              content: [
                {
                  type: 'paragraph',
                  content: [
                    {
                      type: 'text',
                      text: 'Áp dụng cho sinh viên đã được đồng ý hoãn xét công nhận tốt nghiệp, hoặc xét công nhận tốt nghiệp sau đợt chính khóa.',
                    },
                  ],
                },
                {
                  type: 'bulletList',
                  content: [
                    {
                      type: 'listItem',
                      content: [
                        {
                          type: 'paragraph',
                          content: [
                            { type: 'text', text: 'Nộp kèm ' },
                            { type: 'text', text: 'minh chứng chứng chỉ ngoại ngữ, tin học', marks: [{ type: 'bold' }] },
                            { type: 'text', text: '.' },
                          ],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          },
          { id: 'co-cai-thien', type: 'radio', label: 'Học phần cải thiện, học lại đã hoàn thành', required: true, options: ['Không có', 'Có'] },
          {
            id: 'hoc-phan-cai-thien',
            type: 'table',
            label: 'Các học phần cải thiện, học lại đã hoàn thành',
            required: false,
            help: 'Chỉ điền khi chọn Có.',
            columns: [
              { type: 'text', label: 'Mã học phần' },
              { type: 'text', label: 'Tên học phần', placeholder: 'VD: Luật Hình sự phần chung' },
              { type: 'number', label: 'Điểm', placeholder: 'Thang 10' },
              { type: 'select', label: 'Học kỳ', options: ['Học kỳ 1', 'Học kỳ 2'] },
              { type: 'text', label: 'Năm học', placeholder: 'VD: 2026 - 2027' },
              { type: 'date', label: 'Ngày công bố điểm' },
            ],
            rowName: 'học phần',
          },
          { id: 'diem-tb', type: 'number', label: 'Điểm trung bình tích lũy (thang 4)', required: true, placeholder: 'VD: 3,25' },
          { id: 'hoc-ky', type: 'radio', label: 'Tính đến học kỳ', required: true, options: ['Học kỳ 1', 'Học kỳ 2'] },
          { id: 'nam-hoc', type: 'text', label: 'Năm học', required: true, placeholder: 'VD: 2026 - 2027' },
          { id: 'tin-hoc', type: 'text', label: 'Chứng chỉ tin học', required: true, placeholder: 'VD: MOS Word, Excel' },
          {
            id: 'ngoai-ngu',
            type: 'table',
            label: 'Trình độ ngoại ngữ đạt được',
            required: true,
            columns: [
              { type: 'select', label: 'Ngoại ngữ', options: ['Tiếng Anh', 'Tiếng Pháp', 'Tiếng Nhật', 'Tiếng Trung'] },
              { type: 'text', label: 'Loại chứng chỉ', placeholder: 'VD: TOEIC' },
              { type: 'text', label: 'Điểm, trình độ đạt được', placeholder: 'VD: 600' },
              { type: 'text', label: 'Ghi chú' },
            ],
            rowName: 'ngoại ngữ',
          },
        ],
      },
      {
        id: 's-minh-chung',
        title: 'Minh chứng',
        main: false,
        questions: [{ id: 'minh-chung', type: 'file', label: 'Chứng chỉ ngoại ngữ, tin học', required: true, maxMB: 5, accept: ['pdf', 'jpg', 'png'] }],
      },
    ],
  },

  // 25. Mẫu số 8.2/ĐNHXCNTN: Đơn đề nghị hoãn xét, công nhận tốt nghiệp và cấp bằng cử nhân
  {
    id: 'hxtn',
    name: 'Hoãn xét, công nhận tốt nghiệp',
    prefix: 'HXTN',
    description: 'Hoãn xét, công nhận tốt nghiệp và cấp bằng cử nhân để học cải thiện thay đổi hạng tốt nghiệp',
    status: 'draft',
    sections: [
      {
        id: 's-de-nghi',
        title: 'Hoãn xét tốt nghiệp',
        main: true,
        questions: [
          {
            id: 'info-luu-y',
            type: 'info',
            color: 'blue',
            content: {
              type: 'doc',
              content: [
                {
                  type: 'paragraph',
                  content: [
                    { type: 'text', text: 'Nộp đơn ' },
                    { type: 'text', text: 'trước 10 ngày làm việc', marks: [{ type: 'bold' }] },
                    { type: 'text', text: ' kể từ thời gian quy định trong thông báo, kế hoạch xét tốt nghiệp của Trường.' },
                  ],
                },
              ],
            },
          },
          { id: 'dot', type: 'text', label: 'Hoãn xét công nhận tốt nghiệp đợt', required: true, placeholder: 'VD: tháng 6/2027' },
        ],
      },
      {
        id: 's-li-do',
        title: 'Lí do và cam kết',
        main: false,
        questions: [
          {
            id: 'li-do-chon',
            type: 'check',
            label: 'Lí do đề nghị',
            required: true,
            options: [
              'Đã đăng ký học cải thiện điểm để thay đổi hạng tốt nghiệp, nhưng đến nay chưa có kết quả',
              'Có nguyện vọng đăng ký học cải thiện để thay đổi hạng tốt nghiệp trong thời gian tới',
            ],
          },
          { id: 'hoc-ky', type: 'radio', label: 'Học kỳ dự kiến học cải thiện', required: false, options: ['Học kỳ 1', 'Học kỳ 2'] },
          { id: 'nam-hoc', type: 'text', label: 'Năm học', required: false, placeholder: 'VD: 2026 - 2027' },
          {
            id: 'cam-ket',
            type: 'check',
            label: 'Cam kết',
            required: true,
            options: [
              'Việc tôi đề nghị hoãn xét công nhận tốt nghiệp và cấp bằng cử nhân trình độ đại học là hoàn toàn tự nguyện và tôi tự chịu trách nhiệm với quyết định của mình.',
            ],
          },
        ],
      },
    ],
  },

  // 26. Mẫu số 8.3/ĐNXCNTNCTĐTC: Đơn đề nghị xét, công nhận tốt nghiệp theo chuẩn đầu ra chương trình chuẩn
  {
    id: 'xtnc',
    name: 'Xét tốt nghiệp theo chuẩn đầu ra chương trình chuẩn',
    prefix: 'XTNC',
    description: 'Sinh viên chương trình chất lượng cao chưa đủ điều kiện tốt nghiệp chất lượng cao, xin xét tốt nghiệp theo chuẩn đầu ra của chương trình chuẩn',
    status: 'draft',
    sections: [
      {
        id: 's-de-nghi',
        title: 'Xét tốt nghiệp theo chương trình chuẩn',
        main: true,
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
                            {
                              type: 'text',
                              text: 'Dành cho sinh viên lớp chất lượng cao chưa đạt điểm trung bình tích lũy, chuẩn ngoại ngữ hoặc chứng chỉ tin học MOS, có nguyện vọng nhận bằng tốt nghiệp chương trình chuẩn (đại trà).',
                            },
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
                            { type: 'text', text: 'Không đạt chuẩn đầu ra chất lượng cao nhưng đạt chuẩn chương trình chuẩn: ' },
                            { type: 'text', text: 'nộp kèm bản chụp phiếu điểm, chứng chỉ ngoại ngữ', marks: [{ type: 'bold' }] },
                            { type: 'text', text: ' (mang bản chính để đối chiếu).' },
                          ],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          },
          { id: 'hoc-ky', type: 'radio', label: 'Tính đến học kỳ', required: true, options: ['Học kỳ 1', 'Học kỳ 2'] },
          { id: 'nam-hoc', type: 'text', label: 'Năm học', required: true, placeholder: 'VD: 2026 - 2027' },
          {
            id: 'truong-hop',
            type: 'check',
            label: 'Hiện tôi thuộc trường hợp',
            required: true,
            options: [
              'Điểm trung bình tích lũy toàn khóa chưa đạt yêu cầu của chương trình chất lượng cao',
              'Chưa đạt chuẩn đầu ra ngoại ngữ của chương trình chất lượng cao, nhưng đã đạt chuẩn tiếng Anh của chương trình chuẩn',
              'Chưa có phiếu điểm, chứng chỉ tin học MOS',
            ],
          },
          { id: 'diem-tb', type: 'number', label: 'Điểm trung bình tích lũy toàn khóa (thang 4)', required: false },
          { id: 'chung-chi', type: 'text', label: 'Chứng chỉ tiếng Anh đạt được', required: false, placeholder: 'VD: TOEIC 600/990, TOEFL iBT 61/120, IELTS 5.5/9.0' },
          { id: 'khoa', type: 'text', label: 'Khoa được Trường bố trí từ đầu khóa học', required: false },
          { id: 'mos', type: 'text', label: 'Chứng chỉ tin học MOS còn thiếu', required: false },
        ],
      },
      {
        id: 's-minh-chung',
        title: 'Minh chứng',
        main: false,
        questions: [{ id: 'minh-chung', type: 'file', label: 'Giấy tờ minh chứng', required: false, maxMB: 5, accept: ['pdf', 'jpg', 'png'] }],
      },
    ],
  },

  // 27. Mẫu số 10.1/ĐNTH: Đơn đề nghị (các nội dung khác)
  {
    id: 'dn',
    name: 'Đơn đề nghị (nội dung khác)',
    prefix: 'DN',
    description: 'Đề nghị các nội dung khác chưa có loại đơn riêng',
    status: 'draft',
    sections: [
      {
        id: 's-de-nghi',
        title: 'Đề nghị',
        main: true,
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
                      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Nhận kết quả trực tiếp tại Phòng Đào tạo Đại học (A.102).' }] }],
                    },
                    {
                      type: 'listItem',
                      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Liên hệ: (028) 39400.989 - nhánh 112; email: dtdh@hcmulaw.edu.vn.' }] }],
                    },
                  ],
                },
              ],
            },
          },
          { id: 'noi-dung', type: 'para', label: 'Nội dung đề nghị', required: true },
          { id: 'li-do', type: 'para', label: 'Lí do đề nghị', required: true },
          { id: 'minh-chung', type: 'file', label: 'Giấy tờ minh chứng', required: false, maxMB: 5, accept: ['pdf', 'jpg', 'png'] },
          { id: 'cam-ket', type: 'check', label: 'Cam kết', required: true, options: ['Tôi cam kết thực hiện đầy đủ các nghĩa vụ theo quy định của Trường.'] },
        ],
      },
    ],
  },

  // 28. Mẫu ĐĐNPA: Đơn đề nghị, phản ánh
  {
    id: 'dnpa',
    name: 'Đề nghị, phản ánh',
    prefix: 'DNPA',
    description: 'Đề nghị Phòng Đào tạo Đại học xem xét, giải quyết một việc, hoặc phản ánh sự việc',
    status: 'draft',
    sections: [
      {
        id: 's-de-nghi',
        title: 'Đề nghị, phản ánh',
        main: true,
        questions: [
          { id: 'noi-dung', type: 'para', label: 'Việc đề nghị xem xét, giải quyết', required: true },
          { id: 'minh-chung', type: 'file', label: 'Minh chứng, giấy tờ liên quan', required: false, maxMB: 5, accept: ['pdf', 'jpg', 'png'] },
          {
            id: 'cam-ket',
            type: 'check',
            label: 'Cam kết',
            required: true,
            options: ['Tôi cam kết và chịu trách nhiệm về nội dung được trình bày nêu trên là đúng sự thật.'],
          },
        ],
      },
    ],
  },

  // 29. Mẫu số 10.3/ĐKDTKTHP: Đơn đăng ký bổ sung danh sách dự thi do đóng học phí muộn
  {
    id: 'dtm',
    name: 'Dự thi kết thúc học phần do đóng học phí muộn',
    prefix: 'DTM',
    description: 'Đăng ký bổ sung danh sách dự thi kết thúc học phần do đóng học phí muộn',
    status: 'draft',
    sections: [
      {
        id: 's-hoc-phan',
        title: 'Đăng ký bổ sung danh sách dự thi',
        main: true,
        hint: 'Mỗi dòng là một học phần bạn đăng ký dự thi.',
        questions: [
          { id: 'hoc-ky', type: 'radio', label: 'Học kỳ', required: true, options: ['Học kỳ 1', 'Học kỳ 2'] },
          { id: 'nam-hoc', type: 'text', label: 'Năm học', required: true, placeholder: 'VD: 2026 - 2027' },
          {
            id: 'hoc-phan',
            type: 'table',
            label: 'Các học phần đăng ký dự thi',
            required: true,
            help: 'Ghi đầy đủ tên học phần.',
            columns: [
              { type: 'text', label: 'Tên học phần', placeholder: 'VD: Luật Hình sự phần chung' },
              { type: 'text', label: 'Đăng ký thi với lớp', placeholder: 'Lớp học phần' },
              { type: 'text', label: 'Thời gian thi', placeholder: 'VD: 7h30' },
              { type: 'date', label: 'Ngày thi' },
            ],
            rowName: 'học phần',
          },
        ],
      },
      {
        id: 's-li-do',
        title: 'Lí do và cam kết',
        main: false,
        questions: [
          { id: 'hinh-thuc-dong', type: 'text', label: 'Đã đóng học phí theo hình thức', required: true, placeholder: 'VD: chuyển khoản' },
          { id: 'ngay-dong', type: 'date', label: 'Ngày đóng học phí', required: true },
          { id: 'minh-chung', type: 'file', label: 'Biên lai, minh chứng đóng học phí', required: true, maxMB: 5, accept: ['pdf', 'jpg', 'png'] },
          {
            id: 'cam-ket',
            type: 'check',
            label: 'Cam kết',
            required: true,
            options: ['Tôi cam kết sẽ đóng học phí đúng thời gian quy định trong học kỳ tiếp theo.'],
          },
        ],
      },
    ],
  },

  // 30. Mẫu số 10.4/ĐNCLT-TOEIC: Đơn đề nghị chuyển lịch thi TOEIC
  {
    id: 'cltt',
    name: 'Chuyển lịch thi TOEIC',
    prefix: 'CLTT',
    description: 'Chuyển lịch thi TOEIC (gửi Tổ chức Giáo dục IIG Việt Nam - Chi nhánh TP. Hồ Chí Minh)',
    status: 'draft',
    sections: [
      {
        id: 's-lich-thi',
        title: 'Chuyển lịch thi TOEIC',
        main: true,
        questions: [
          {
            id: 'info-luu-y',
            type: 'info',
            color: 'blue',
            content: {
              type: 'doc',
              content: [
                {
                  type: 'paragraph',
                  content: [
                    { type: 'text', text: 'Đơn gửi Tổ chức Giáo dục IIG Việt Nam - Chi nhánh Thành phố Hồ Chí Minh. Lí do cá nhân: nộp ' },
                    { type: 'text', text: 'tối thiểu trước 05 ngày làm việc', marks: [{ type: 'bold' }] },
                    { type: 'text', text: ' tính đến ngày thi.' },
                  ],
                },
              ],
            },
          },
          { id: 'dot-cu', type: 'text', label: 'Đợt thi đã đăng ký', required: true, placeholder: 'VD: đợt 1 tháng 3/2027' },
          { id: 'ngay-thi-cu', type: 'date', label: 'Ngày thi đã đăng ký', required: true },
          { id: 'dot-moi', type: 'text', label: 'Xin chuyển sang đợt', required: true, placeholder: 'VD: đợt 2 tháng 4/2027' },
          { id: 'ngay-thi-moi', type: 'date', label: 'Ngày thi mới', required: true },
        ],
      },
      {
        id: 's-li-do',
        title: 'Lí do và cam kết',
        main: false,
        questions: [
          {
            id: 'truong-hop',
            type: 'radio',
            label: 'Tôi là sinh viên thuộc trường hợp',
            required: true,
            options: [
              'Bị bệnh viêm mũi, viêm họng, ho… có thể gây tiếng động ảnh hưởng thí sinh khác (giấy khám của bệnh viện đa khoa, phòng khám bệnh viện công lập, không trước 03 ngày tính đến ngày thi)',
              'Không đủ khoảng cách 05 ngày đăng ký dự thi',
              'Bất khả kháng không thể tham dự thi (được cán bộ coi thi đồng ý)',
              'Mất chứng minh nhân dân, căn cước công dân hoặc hộ chiếu (kèm đơn cớ mất có xác nhận của cơ quan có thẩm quyền)',
              'Vì lí do cá nhân khác',
            ],
          },
          { id: 'li-do', type: 'para', label: 'Trình bày lí do', required: false },
          { id: 'minh-chung', type: 'file', label: 'Giấy tờ minh chứng', required: true, maxMB: 5, accept: ['pdf', 'jpg', 'png'] },
          {
            id: 'cam-ket',
            type: 'check',
            label: 'Cam kết',
            required: true,
            options: [
              'Tôi cam kết sẽ thực hiện đúng quy định của Tổ chức Giáo dục IIG Việt Nam và sẽ chịu hoàn toàn trách nhiệm các thông tin nêu trên là đúng sự thật.',
            ],
          },
        ],
      },
    ],
  },

  // 31. Mẫu số 10.5/ĐNHLT-TOEIC: Đơn đề nghị hủy lịch thi TOEIC
  {
    id: 'htt',
    name: 'Hủy lịch thi TOEIC',
    prefix: 'HTT',
    description: 'Hủy lịch thi TOEIC (gửi Tổ chức Giáo dục IIG Việt Nam - Chi nhánh TP. Hồ Chí Minh)',
    status: 'draft',
    sections: [
      {
        id: 's-lich-thi',
        title: 'Hủy lịch thi TOEIC',
        main: true,
        questions: [
          {
            id: 'info-luu-y',
            type: 'info',
            color: 'blue',
            content: {
              type: 'doc',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Đơn gửi Tổ chức Giáo dục IIG Việt Nam - Chi nhánh Thành phố Hồ Chí Minh.' }] }],
            },
          },
          { id: 'dot', type: 'text', label: 'Đợt thi xin hủy', required: true, placeholder: 'VD: đợt 1 tháng 3/2027' },
          { id: 'ngay-thi', type: 'date', label: 'Ngày thi', required: true },
        ],
      },
      {
        id: 's-li-do',
        title: 'Lí do và cam kết',
        main: false,
        questions: [
          {
            id: 'truong-hop',
            type: 'radio',
            label: 'Tôi là sinh viên thuộc trường hợp',
            required: true,
            options: [
              'Đã dự thi và đạt chuẩn đầu ra TOEIC theo chương trình đào tạo ở đợt trước tại Trường',
              'Không đủ khoảng cách 05 ngày đăng ký dự thi',
              'Lí do khác',
            ],
          },
          {
            id: 'dot-da-dat',
            type: 'text',
            label: 'Đợt thi đã đạt chuẩn',
            required: false,
            help: 'Chỉ ghi khi đã đạt chuẩn.', placeholder: 'VD: tháng 1/2027, ngày thi 15/01/2027',
          },
          { id: 'diem-da-dat', type: 'number', label: 'Điểm đã đạt', required: false },
          { id: 'li-do-khac', type: 'para', label: 'Lí do khác', required: false, help: 'Ghi rõ nếu chọn Lí do khác.' },
          { id: 'minh-chung', type: 'file', label: 'Giấy tờ minh chứng', required: true, maxMB: 5, accept: ['pdf', 'jpg', 'png'] },
          {
            id: 'cam-ket',
            type: 'check',
            label: 'Cam kết',
            required: true,
            options: ['Tôi cam kết chịu hoàn toàn trách nhiệm các thông tin nêu trên là đúng sự thật.'],
          },
        ],
      },
    ],
  },

  // 32. Mẫu số 10.6/ĐNCLTSV: Đơn đề nghị cấp lại thẻ sinh viên (VB2CQ, VLVH, TX)
  {
    id: 'cltsv',
    name: 'Cấp lại thẻ sinh viên (VB2 chính quy, VLVH, từ xa)',
    prefix: 'CLTSV',
    description: 'Cấp lại thẻ sinh viên cho sinh viên văn bằng 2 chính quy, vừa làm vừa học, từ xa',
    status: 'draft',
    sections: [
      {
        id: 's-thong-tin',
        title: 'Thông tin cấp lại thẻ',
        main: true,
        questions: [
          {
            id: 'info-luu-y',
            type: 'info',
            color: 'blue',
            content: {
              type: 'doc',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'Áp dụng cho sinh viên chương trình văn bằng 2 hình thức chính quy, vừa làm vừa học, từ xa.' }],
                },
              ],
            },
          },
          { id: 'gioi-tinh', type: 'radio', label: 'Giới tính', required: true, options: ['Nam', 'Nữ'] },
          { id: 'nam-thu', type: 'number', label: 'Sinh viên năm thứ', required: true },
          { id: 'ngay-cap-cccd', type: 'date', label: 'Ngày cấp CCCD', required: true },
          { id: 'noi-cap-cccd', type: 'text', label: 'Nơi cấp CCCD', required: true },
          { id: 'noi-thuong-tru', type: 'text', label: 'Nơi thường trú', required: true },
          { id: 'anh-the', type: 'file', label: 'Ảnh màu 2x3', required: true, help: 'Ảnh chân dung rõ mặt.', maxMB: 5, accept: ['jpg', 'png'] },
        ],
      },
      {
        id: 's-li-do',
        title: 'Lí do và cam kết',
        main: false,
        questions: [
          { id: 'li-do', type: 'para', label: 'Lí do đề nghị cấp lại thẻ', required: true },
          { id: 'cam-ket', type: 'check', label: 'Cam kết', required: true, options: ['Tôi xin cam đoan những thông tin trên là đúng sự thật.'] },
        ],
      },
    ],
  },
].map((rawFormType) => FormTypeSchema.parse(rawFormType));
