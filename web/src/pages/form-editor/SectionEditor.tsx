/* Một phần trong trình soạn (như .fe-sec của artifact/js/forms-page.js): số thứ tự, tiêu đề, nút đưa lên / xuống / xóa phần,
   công tắc Nội dung chính, ô tiêu đề và mô tả phần, các câu hỏi, nút "+ Thêm câu hỏi". */
import { FORM_TYPE_ISSUE_TARGET, type FormSection, type Question } from '@ulaw/shared';
import { Button } from '../../components/Button';
import { Field } from '../../components/Field';
import { useDraftIssues } from './draftIssues';
import { EditorIconButton } from './EditorIconButton';
import { duplicateQuestion, moveItem, newQuestion, removeAt, replaceAt } from './formTypeDraft';
import { QuestionEditor, type QuestionAction } from './QuestionEditor';
import styles from './FormTypeEditor.module.css';

/** Việc làm với cả phần, do trình soạn thực hiện. */
export type SectionAction = 'moveUp' | 'moveDown' | 'delete';

interface SectionEditorProps {
  section: FormSection;
  /** Vị trí phần, đếm từ 0 */
  index: number;
  sectionCount: number;
  /** Id câu hỏi vừa thêm (để đưa con trỏ vào); null = không có */
  focusQuestionId: string | null;
  /** Đưa con trỏ vào ô tiêu đề phần ngay khi hiện (phần vừa thêm) */
  autoFocus: boolean;
  onChange: (nextSection: FormSection) => void;
  onAction: (action: SectionAction) => void;
  /** Báo câu hỏi vừa thêm, để đưa con trỏ vào */
  onQuestionAdded: (questionId: string) => void;
}

/**
 * Thẻ soạn một phần. Còn một phần thì không xóa được.
 * @param props  xem SectionEditorProps
 * @returns      thẻ <section>
 */
export function SectionEditor({ section, index, sectionCount, focusQuestionId, autoFocus, onChange, onAction, onQuestionAdded }: SectionEditorProps) {
  const setQuestions = (questions: Question[]) => onChange({ ...section, questions });
  const invalidTargets = useDraftIssues();

  /**
   * Làm một việc với câu hỏi ở vị trí questionIndex.
   * @param questionIndex  vị trí câu hỏi
   * @param action         đưa lên, đưa xuống, nhân bản, xóa
   */
  const actOnQuestion = (questionIndex: number, action: QuestionAction) => {
    const { questions } = section;
    if (action === 'moveUp') setQuestions(moveItem(questions, questionIndex, questionIndex - 1));
    else if (action === 'moveDown') setQuestions(moveItem(questions, questionIndex, questionIndex + 1));
    else if (action === 'duplicate') setQuestions(duplicateQuestion(questions, questionIndex));
    else setQuestions(removeAt(questions, questionIndex));
  };

  /** Thêm câu hỏi trống ở cuối phần, đưa con trỏ vào ô nội dung. */
  const addQuestion = () => {
    const question = newQuestion();
    setQuestions([...section.questions, question]);
    onQuestionAdded(question.id);
  };

  return (
    <section className={styles.card} aria-label={`Phần ${index + 1}`}>
      <div className={styles.cardHead}>
        <span className={styles.sectionNumber}>{index + 1}</span>
        <h2 className={section.title ? '' : styles.untitled}>{section.title || 'Phần chưa có tên'}</h2>
        <div className={styles.iconActions}>
          <EditorIconButton icon="up" label="Đưa phần lên" disabled={index === 0} onClick={() => onAction('moveUp')} />
          <EditorIconButton icon="down" label="Đưa phần xuống" disabled={index === sectionCount - 1} onClick={() => onAction('moveDown')} />
          <EditorIconButton icon="delete" label="Xóa phần" disabled={sectionCount < 2} onClick={() => onAction('delete')} />
        </div>
      </div>

      <label className={styles.switch}>
        <input type="checkbox" checked={section.main} onChange={(event) => onChange({ ...section, main: event.target.checked })} />
        <span>Nội dung chính — hiện trong xem nhanh (›) ở các bảng đơn</span>
      </label>

      <div className={styles.grid2}>
        <Field label="Tiêu đề phần">
          <input
            value={section.title}
            placeholder="VD: Lí do bảo lưu"
            aria-invalid={invalidTargets.has(FORM_TYPE_ISSUE_TARGET.sectionTitle(section.id)) || undefined}
            autoFocus={autoFocus}
            onChange={(event) => onChange({ ...section, title: event.target.value })}
          />
        </Field>
        <Field label="Mô tả phần" optional>
          <input value={section.hint ?? ''} onChange={(event) => onChange({ ...section, hint: event.target.value })} />
        </Field>
      </div>

      <div className={styles.questionList}>
        {section.questions.length ? (
          section.questions.map((question, questionIndex) => (
            <QuestionEditor
              key={question.id}
              question={question}
              index={questionIndex}
              questionCount={section.questions.length}
              autoFocus={question.id === focusQuestionId}
              onChange={(nextQuestion) => setQuestions(replaceAt(section.questions, questionIndex, nextQuestion))}
              onAction={(action) => actOnQuestion(questionIndex, action)}
            />
          ))
        ) : (
          <p className={styles.hint}>Phần này chưa có câu hỏi.</p>
        )}
      </div>
      <Button onClick={addQuestion} className={styles.addButton}>
        + Thêm câu hỏi
      </Button>
    </section>
  );
}
