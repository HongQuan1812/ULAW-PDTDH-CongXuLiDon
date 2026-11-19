/* Câu trả lời mẫu cho đơn mẫu của mọi loại đơn: dựng theo cấu trúc loại đơn (từng câu hỏi, từng cột bảng),
   nội dung lấy theo mã câu hỏi / tên cột cho hợp nghĩa, thay đổi theo số thứ tự để các đơn không giống hệt nhau. */
import type { FileRef, FormAnswers, FormSection, Question, TableCell, TableColumn } from '../aux-schema';

/* Học phần mẫu: [tên học phần, số tín chỉ, học phần tương đương ở cơ sở khác, cơ sở đào tạo]. */
export const SAMPLE_SUBJECTS: [string, number, string, string][] = [
  ['Triết học Mác – Lênin', 3, 'Triết học Mác – Lênin', 'ĐH KHXH&NV – ĐHQG TP.HCM'],
  ['Kinh tế chính trị Mác – Lênin', 2, 'Kinh tế chính trị Mác – Lênin', 'ĐH Kinh tế TP.HCM'],
  ['Chủ nghĩa xã hội khoa học', 2, 'Chủ nghĩa xã hội khoa học', 'ĐH Sư phạm TP.HCM'],
  ['Lịch sử Đảng Cộng sản Việt Nam', 2, 'Lịch sử Đảng Cộng sản Việt Nam', 'ĐH Công nghiệp TP.HCM'],
  ['Tư tưởng Hồ Chí Minh', 2, 'Tư tưởng Hồ Chí Minh', 'ĐH Mở TP.HCM'],
  ['Tiếng Anh pháp lý 1', 3, 'English for Specific Purposes 1', 'ĐH Sư phạm TP.HCM'],
  ['Tin học đại cương', 2, 'Tin học căn bản', 'ĐH Bách khoa – ĐHQG TP.HCM'],
  ['Logic học', 2, 'Logic học đại cương', 'ĐH KHXH&NV – ĐHQG TP.HCM'],
  ['Xã hội học pháp luật', 2, 'Xã hội học đại cương', 'ĐH Mở TP.HCM'],
  ['Kinh tế vi mô', 3, 'Microeconomics', 'ĐH Kinh tế – Luật'],
  ['Luật Hình sự phần chung', 3, 'Luật Hình sự 1', 'ĐH Kinh tế – Luật'],
  ['Luật Dân sự 1', 3, 'Luật Dân sự đại cương', 'ĐH Mở TP.HCM'],
];

/* Lí do mẫu cho câu Đoạn văn, theo mã câu hỏi. */
const PARAGRAPHS: Record<string, string[][]> = {
  'li-do': [
    ['Em đi làm thêm buổi tối nên trùng lịch học, thi của học phần.', 'Em kính mong Phòng Đào tạo Đại học xem xét, giải quyết.'],
    ['Gia đình em có việc đột xuất, em phải về quê một thời gian.'],
    ['Em bị ốm phải điều trị tại bệnh viện, có giấy xác nhận kèm theo.', 'Em xin cảm ơn Phòng Đào tạo Đại học.'],
  ],
  'li-do-khac': [['Em có lịch công tác của cơ quan trùng thời gian.']],
  'noi-dung': [
    ['Em đề nghị Phòng Đào tạo Đại học xác nhận lại điểm học phần đã nhập trên Cổng đào tạo.'],
    ['Em đề nghị được cấp bảng điểm tạm thời để nộp hồ sơ học bổng.'],
  ],
  'ket-qua-cac-nam': [['Năm thứ nhất: học tập loại Khá, rèn luyện loại Tốt.', 'Năm thứ hai: học tập loại Giỏi, rèn luyện loại Tốt; không bị kỷ luật.']],
};

/* Câu Trả lời ngắn, theo mã câu hỏi. */
const TEXTS: Record<string, string[]> = {
  'nam-hoc': ['2026 - 2027', '2025 - 2026'],
  'tu-nam-hoc': ['2026 - 2027'],
  'den-nam-hoc': ['2026 - 2027', '2027 - 2028'],
  'nganh-moi': ['Luật Thương mại quốc tế', 'Quản trị - Luật'],
  'ctdt-moi': ['Chương trình chuẩn'],
  'to-hop-nganh-moi': ['A01', 'D01'],
  'phuong-thuc': ['Xét tuyển kết quả thi tốt nghiệp THPT'],
  'to-hop': ['C00', 'A01', 'D01'],
  'doi-tuong': ['Không thuộc đối tượng ưu tiên'],
  'khu-vuc': ['KV2', 'KV1', 'KV3'],
  'diem-tich-luy': ['Năm thứ 2: 3,2/4', 'Năm thứ 1: 24/22'],
  'hoan-thi': ['Học kỳ 1, năm học 2025 - 2026', 'Học kỳ 2, năm học 2025 - 2026'],
  'hoc-ky-duoc-xet': ['Học kỳ 1, năm học 2026 - 2027'],
  'ten-hoc-phan': ['Luật Hình sự phần chung', 'Luật Dân sự 1', 'Luật Hiến pháp'],
  'lop-hoc-phan': ['HS2501', 'DS2503', 'HP2402'],
  'so-quyet-dinh': ['1234/QĐ-ĐHL', '2051/QĐ-ĐHL'],
  'chung-chi': ['TOEIC 600/990', 'IELTS 5.5/9.0'],
  'truong-dang-hoc': ['Trường Đại học Kinh tế - Luật', 'Trường Đại học Cần Thơ'],
  'noi-thuong-tru': ['12 Lê Lợi, phường Bến Thành, TP. Hồ Chí Minh', '45 Trần Hưng Đạo, phường Ninh Kiều, TP. Cần Thơ'],
  'nganh-xin-hoc': ['Luật', 'Luật Kinh tế'],
  'co-so-dao-tao': ['ĐH Kinh tế – Luật', 'ĐH Mở TP.HCM'],
  'hinh-thuc-dao-tao': ['Chính quy', 'Vừa làm vừa học'],
  'truong-cu': ['Trường Đại học Cần Thơ', 'Trường Đại học Huế'],
  'co-quan': ['Văn phòng Luật sư Minh Khang', 'Tòa án nhân dân Quận 1'],
  'dia-chi': ['18 Nguyễn Huệ, phường Sài Gòn, TP. Hồ Chí Minh', '131 Nam Kỳ Khởi Nghĩa, phường Bến Thành, TP. Hồ Chí Minh'],
  dot: ['tháng 6/2027', 'đợt 1 tháng 3/2027'],
  khoa: ['Khoa Luật Thương mại'],
  mos: ['MOS Excel'],
  'noi-cap-cccd': ['Cục Cảnh sát quản lý hành chính về trật tự xã hội'],
  'dot-da-dat': ['tháng 1/2027, ngày thi 15/01/2027'],
  'giang-vien': ['Nguyễn Văn An, Khoa Luật Hình sự', 'Trần Thị Bình, Khoa Luật Dân sự'],
  'tin-hoc': ['MOS Word, Excel'],
  'hinh-thuc-dong': ['chuyển khoản', 'nộp tại ngân hàng'],
  'dot-cu': ['đợt 1 tháng 3/2027'],
  'dot-moi': ['đợt 2 tháng 4/2027'],
};

/* Câu Số, theo mã câu hỏi. */
const NUMBERS: Record<string, number[]> = {
  'diem-nganh-moi': [25.5, 24],
  'nam-thu': [2, 3],
  'diem-tuyen-sinh': [26.25, 24.5],
  'diem-cong': [6.5, 0],
  'diem-giang-vien': [8, 7.5],
  'diem-tai-lop': [8.5, 7],
  'hp-chua-tich-luy': [3, 1],
  'tc-da-tich-luy': [112, 98],
  'vao-nam-thu': [2],
  'diem-tb': [3.25, 2.9],
  'lan-thu': [2],
  'diem-da-dat': [650, 700],
};

/**
 * Chọn một phần tử theo số thứ tự, quay vòng.
 * @param list   danh sách, không rỗng
 * @param index  số thứ tự
 * @returns      phần tử ở vị trí index % độ dài
 */
const pick = <T>(list: readonly T[], index: number): T => list[index % list.length]!;

/**
 * Ngày dạng YYYY-MM-DD, lệch so với ngày gốc một số ngày.
 * @param baseDate  ngày gốc YYYY-MM-DD
 * @param days      số ngày lệch (âm là trước)
 * @returns         ngày YYYY-MM-DD
 */
function shiftDate(baseDate: string, days: number): string {
  const [year, month, day] = baseDate.split('-').map(Number) as [number, number, number];
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return shifted.toISOString().slice(0, 10);
}

/**
 * Giá trị một ô bảng theo tên cột và học phần của dòng.
 * @param column      cột
 * @param subject     học phần mẫu của dòng
 * @param rowIndex    số thứ tự dòng
 * @param baseDate    ngày nộp đơn YYYY-MM-DD (cột ngày lấy quanh ngày này)
 * @returns           ô bảng
 */
function sampleCell(column: TableColumn, subject: (typeof SAMPLE_SUBJECTS)[number], rowIndex: number, baseDate: string): TableCell {
  const label = column.label.trim();
  const [name, credits, equivalent] = subject;

  // Cột Chọn: lựa chọn theo dòng; cột Ngày: ngày học / thi sau ngày nộp
  if (column.type === 'select') return pick(column.options ?? [''], rowIndex);
  if (column.type === 'date') return shiftDate(baseDate, 10 + rowIndex * 7 + (/đến|kết thúc/i.test(label) ? 60 : 0));

  // Cột Số: số tín chỉ, hoặc điểm thang 10
  if (column.type === 'number') return /tín chỉ/i.test(label) ? credits : 7 + (rowIndex % 3) * 0.5;

  // Cột Chữ: theo tên cột
  if (/^Học phần đã hoàn thành/i.test(label)) return equivalent;
  if (/học phần|môn học/i.test(label) && !/mã/i.test(label) && !/điểm/i.test(label)) return name;
  if (/^Mã học phần/i.test(label)) return `LUAT${2101 + rowIndex}`;
  if (/lớp/i.test(label)) return `${/mới/i.test(label) ? 'DS' : 'HS'}25${String(rowIndex + 1).padStart(2, '0')}`;
  if (/thời gian thi/i.test(label)) return pick(['7h30', '9h30', '13h30'], rowIndex);
  if (/số tín chỉ, ĐVHT/i.test(label)) return `${credits} TC`;
  if (/điểm học phần, loại chứng chỉ/i.test(label)) return pick(['Giỏi', 'Khá'], rowIndex);
  if (/năm học/i.test(label)) return '2025 - 2026';
  if (/loại chứng chỉ/i.test(label)) return pick(['TOEIC', 'IELTS'], rowIndex);
  if (/điểm, trình độ/i.test(label)) return pick(['650', '6.0'], rowIndex);
  if (/ghi chú/i.test(label)) return pick(['Còn hạn', 'Bản sao có chứng thực'], rowIndex);
  return column.placeholder?.replace(/^VD:\s*/, '') ?? label;
}

/**
 * Câu trả lời mẫu của một câu hỏi; câu không bắt buộc chỉ điền ở đơn có số thứ tự chẵn.
 * @param question  câu hỏi
 * @param index     số thứ tự đơn mẫu (để đổi nội dung giữa các đơn)
 * @param code      mã đơn (để đặt id tệp)
 * @param baseDate  ngày nộp đơn YYYY-MM-DD
 * @returns         câu trả lời, hoặc undefined nếu để trống
 */
function sampleAnswer(question: Question, index: number, code: string, baseDate: string): FormAnswers[string] | undefined {
  if (question.type === 'info') return undefined;
  if (!question.required && index % 2 === 1) return undefined;

  switch (question.type) {
    case 'text':
      return pick(TEXTS[question.id] ?? [question.placeholder?.replace(/^VD:\s*/, '') ?? 'Theo hồ sơ đính kèm'], index);
    case 'para':
      return { type: 'doc', content: pick(PARAGRAPHS[question.id] ?? PARAGRAPHS['li-do']!, index).map((text) => ({ type: 'paragraph', content: [{ type: 'text', text }] })) };
    case 'number':
      return pick(NUMBERS[question.id] ?? [1], index);
    case 'date':
      return shiftDate(baseDate, /^(ngay-cong-bo|ngay-quyet-dinh|ngay-dong|ngay-cap-cccd|ngay-thi-cu|tu-ngay)$/.test(question.id) ? -20 - index : 14 + index);
    case 'radio':
    case 'select':
      return pick(question.options, index);
    case 'check':
      return question.options.length === 1 ? [...question.options] : question.options.slice(index % question.options.length, (index % question.options.length) + 1 + (index % 2));
    case 'table':
      return Array.from({ length: 1 + (index % 3) }, (_, row) => {
        const subject = pick(SAMPLE_SUBJECTS, index * 3 + row * 5);
        return question.columns.map((column) => sampleCell(column, subject, row, baseDate));
      });
    case 'file': {
      const extension = question.accept.includes('pdf') ? 'pdf' : question.accept[0]!;
      const file: FileRef = { id: `${code}-${question.id}`, name: `${question.id}-${index + 1}.${extension}`, sizeBytes: 120_000 + ((index * 7_919) % 800_000) };
      return [file];
    }
  }
}

/**
 * Câu trả lời mẫu của cả lá đơn theo cấu trúc loại đơn.
 * @param sections     các phần của loại đơn
 * @param index        số thứ tự đơn mẫu
 * @param code         mã đơn
 * @param baseDate     ngày nộp đơn YYYY-MM-DD
 * @param fileIdPrefix tiền tố id tệp mẫu (id tệp = tiền tố + mã đơn + mã câu hỏi)
 * @returns            câu trả lời theo id câu hỏi
 */
export function sampleAnswersFor(sections: FormSection[], index: number, code: string, baseDate: string, fileIdPrefix: string): FormAnswers {
  const answers: FormAnswers = {};
  for (const question of sections.flatMap((section) => section.questions)) {
    const answer = sampleAnswer(question, index, `${fileIdPrefix}${code}`, baseDate);
    if (answer !== undefined) answers[question.id] = answer;
  }
  return answers;
}
