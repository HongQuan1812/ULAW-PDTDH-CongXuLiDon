/* Câu trả lời ban đầu của lá đơn mới, và vài phép tính nhỏ trên câu trả lời dùng khi vẽ đơn. */
import {
  emptyAnswer,
  isAnswerable,
  type FormAnswers,
  type FormSection,
  type QuestionOf,
  type TableCell,
  type TableColumn,
} from '@ulaw/shared';

/**
 * Một dòng trống của bảng nhiều dòng.
 * @param columns  các cột của bảng
 * @returns        mỗi cột một ô trống: cột chữ "", cột số null
 */
export function emptyTableRow(columns: readonly TableColumn[]): TableCell[] {
  return columns.map((column) => (column.type === 'number' ? null : ''));
}

/**
 * Câu trả lời ban đầu của lá đơn mới: mọi câu đều trống, bảng chưa có dòng nào (giống câu tải tệp chưa có tệp nào).
 * Câu bắt buộc mà vẫn trống thì báo lỗi khi bấm Gửi đơn, vd bảng: "Thêm ít nhất một môn."
 * @param sections  các phần của loại đơn
 * @returns         câu trả lời trống theo id câu hỏi (không có khối thông báo)
 */
export function initialAnswers(sections: readonly FormSection[]): FormAnswers {
  const answers: FormAnswers = {};
  sections.forEach((section) => {
    section.questions.filter(isAnswerable).forEach((question) => {
      answers[question.id] = emptyAnswer(question);
    });
  });
  return answers;
}

/**
 * Tổng của một cột số trong bảng (ô trống hoặc không phải số tính là 0).
 * @param rows         các dòng của bảng
 * @param columnIndex  thứ tự cột, bắt đầu từ 0
 * @returns            tổng, vd 9
 */
export function sumColumn(rows: readonly TableCell[][], columnIndex: number): number {
  return rows.reduce((total, row) => {
    const cell = row[columnIndex];
    return total + (typeof cell === 'number' && Number.isFinite(cell) ? cell : 0);
  }, 0);
}

/**
 * Dòng tổng dưới bảng, vd "3 môn · tổng 9 tín chỉ".
 * @param question  câu hỏi bảng nhiều dòng
 * @param rows      các dòng đang có
 * @returns         số dòng và tổng các cột có tính tổng
 */
export function tableTotalText(question: QuestionOf<'table'>, rows: readonly TableCell[][]): string {
  const parts = [`${rows.length} ${question.rowName}`];
  question.columns.forEach((column, columnIndex) => {
    if (!column.sum) return;
    parts.push(`tổng ${sumColumn(rows, columnIndex)} ${column.sumLabel || column.label.toLowerCase()}`);
  });
  return parts.join(' · ');
}
