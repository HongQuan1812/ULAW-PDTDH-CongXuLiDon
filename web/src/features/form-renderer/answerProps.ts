/* Thuộc tính chung của các ô trả lời (mỗi loại câu hỏi một ô). */
import type { AnswerableQuestion, AnswerValue, QuestionOf } from '@ulaw/shared';

export interface AnswerProps<Type extends AnswerableQuestion['type']> {
  /** Câu hỏi cần trả lời */
  question: QuestionOf<Type>;
  /** Câu trả lời hiện tại; undefined = chưa có (vd câu hỏi mới thêm sau khi đơn đã nộp) */
  answerValue: AnswerValue | undefined;
  /** Đổi câu trả lời; chỉ gọi khi sửa được */
  onAnswerChange: (answerValue: AnswerValue) => void;
  /** true: chỉ xem, không sửa */
  readOnly: boolean;
  /** true: câu hỏi đang báo lỗi, tô đỏ ô trả lời */
  invalid: boolean;
  /** id của nhãn câu hỏi, để gắn tên cho ô trả lời (aria-labelledby) */
  labelId: string;
  /** id của dòng mô tả và câu báo lỗi (aria-describedby); không có thì undefined */
  describedBy: string | undefined;
}
