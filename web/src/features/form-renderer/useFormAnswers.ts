/* Giữ câu trả lời của lá đơn đang soạn và lỗi của từng câu hỏi. */
import { useCallback, useMemo, useState } from 'react';
import {
  isAnswerable,
  validateAnswer,
  validateAnswers,
  type AnswerableQuestion,
  type AnswersValidation,
  type AnswerValue,
  type FormAnswers,
  type FormSection,
} from '@ulaw/shared';
import { initialAnswers } from './formAnswers';

/**
 * Câu trả lời và lỗi của lá đơn đang soạn.
 * Lỗi chỉ hiện sau khi bấm Gửi đơn (validate); sau đó sửa câu nào thì lỗi của câu đó cập nhật ngay, hết lỗi thì ẩn.
 * @param sections       các phần của loại đơn
 * @param savedAnswers   câu trả lời có sẵn (sửa đơn, hoặc nháp đơn mới đang soạn); bỏ trống = đơn trống
 * @returns              answers, setAnswer(id, giá trị), questionErrors (lỗi theo id câu hỏi), validate()
 */
export function useFormAnswers(sections: readonly FormSection[], savedAnswers?: FormAnswers) {
  const [answers, setAnswers] = useState<FormAnswers>(() => savedAnswers ?? initialAnswers(sections));
  const [questionErrors, setQuestionErrors] = useState<Record<string, string>>({});

  // Tra câu hỏi theo id, để kiểm tra lại đúng câu vừa sửa
  const questionsById = useMemo(() => {
    const questions = new Map<string, AnswerableQuestion>();
    sections.forEach((section) => section.questions.filter(isAnswerable).forEach((question) => questions.set(question.id, question)));
    return questions;
  }, [sections]);

  /**
   * Đổi câu trả lời của một câu hỏi; câu đó đang báo lỗi thì kiểm tra lại ngay.
   * @param questionId   id câu hỏi
   * @param answerValue  câu trả lời mới
   */
  const setAnswer = useCallback(
    (questionId: string, answerValue: AnswerValue) => {
      setAnswers((previousAnswers) => ({ ...previousAnswers, [questionId]: answerValue }));
      setQuestionErrors((previousErrors) => {
        const question = questionsById.get(questionId);
        if (!(questionId in previousErrors) || !question) return previousErrors;
        const { [questionId]: _oldMessage, ...otherErrors } = previousErrors;
        const message = validateAnswer(question, answerValue);
        return message ? { ...otherErrors, [questionId]: message } : otherErrors;
      });
    },
    [questionsById],
  );

  /**
   * Kiểm tra cả lá đơn và hiện lỗi dưới từng câu.
   * @returns  lỗi từng câu và câu báo chung từng phần (hiện dưới nút Gửi đơn)
   */
  const validate = useCallback((): AnswersValidation => {
    const validation = validateAnswers(sections, answers);
    setQuestionErrors(validation.questionErrors);
    return validation;
  }, [sections, answers]);

  return { answers, setAnswer, questionErrors, validate };
}
