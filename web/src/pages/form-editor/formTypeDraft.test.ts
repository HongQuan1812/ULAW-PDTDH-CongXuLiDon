import { describe, expect, it } from 'vitest';
import { QuestionSchema, type Question } from '@ulaw/shared';
import { changeQuestionType, cleanPrefix, duplicateQuestion, moveItem, newFormTypeDraft, newQuestion } from './formTypeDraft';

describe('bản soạn loại đơn', () => {
  it('loại đơn mới: Nháp, một phần, một câu hỏi trống', () => {
    const draft = newFormTypeDraft();
    expect(draft.status).toBe('draft');
    expect(draft.sections).toHaveLength(1);
    expect(draft.sections[0]!.questions).toHaveLength(1);
  });

  it('đổi loại câu hỏi: giữ id, nội dung; thêm cài đặt mặc định hợp lệ theo schema', () => {
    const question = { ...newQuestion(), label: 'Lí do', required: true };
    (['radio', 'check', 'select', 'file', 'table', 'info', 'para'] as const).forEach((type) => {
      const changed = changeQuestionType(question, type);
      expect(changed).toMatchObject({ id: question.id, label: 'Lí do', type });
      expect(QuestionSchema.safeParse(changed).success).toBe(true);
    });
    expect('required' in changeQuestionType(question, 'info')).toBe(false);
  });

  it('đổi giữa các loại có lựa chọn thì giữ các lựa chọn', () => {
    const radio = { ...changeQuestionType(newQuestion(), 'radio'), options: ['Có', 'Không'] } as Question;
    expect(changeQuestionType(radio, 'select')).toMatchObject({ type: 'select', options: ['Có', 'Không'] });
  });

  it('đổi thứ tự, nhân bản', () => {
    expect(moveItem(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a']);
    expect(moveItem(['a', 'b'], 0, -1)).toEqual(['a', 'b']);
    const questions = [newQuestion(), newQuestion()];
    const duplicated = duplicateQuestion(questions, 0);
    expect(duplicated).toHaveLength(3);
    expect(duplicated[1]!.id).not.toBe(questions[0]!.id);
    expect(duplicated[2]).toBe(questions[1]);
  });

  it('mã đơn bỏ dấu, chỉ giữ chữ in hoa A–Z, tối đa 5 chữ', () => {
    expect(cleanPrefix('bl1')).toBe('BL');
    expect(cleanPrefix('Xét miễn')).toBe('XETMI');
    expect(cleanPrefix('đơn')).toBe('DON');
    expect(cleanPrefix('abcdefg')).toBe('ABCDE');
  });
});
