/* Vẽ nội dung đơn từ cấu trúc loại đơn: mỗi PHẦN là một khung, trong khung là các CÂU HỎI
   (như renderSections của artifact/js/sections.js). Cùng một giao diện dùng cho:
     - trang nộp đơn mới (sửa được)
     - trang chi tiết đơn (sửa được hoặc chỉ xem, tùy trạng thái và quyền)
     - xem nhanh (nút ›) trong các bảng đơn (chỉ xem, chỉ các phần nội dung chính)
     - tab "Xem trước" của trình soạn loại đơn
   Thêm loại câu hỏi mới: khai báo ở shared/src/aux-schema/form-types--question-types.ts, rồi thêm ô trả lời trong QuestionBlock. */
import type { AnswerValue, FormAnswers, FormSection } from '@ulaw/shared';
import { QuestionBlock } from './QuestionBlock';
import styles from './FormRenderer.module.css';

interface FormSectionsProps {
  /** Các phần của loại đơn, theo thứ tự */
  sections: readonly FormSection[];
  /** Câu trả lời theo id câu hỏi */
  answers: FormAnswers;
  /** Đổi câu trả lời của một câu hỏi; không truyền khi chỉ xem */
  onAnswerChange?: (questionId: string, answerValue: AnswerValue) => void;
  /** Lỗi theo id câu hỏi (lấy từ useFormAnswers); chỉ xem thì không hiện */
  questionErrors?: Record<string, string>;
  /** true: chỉ xem, không sửa */
  readOnly?: boolean;
  /** true: chỉ vẽ các phần nội dung chính (main), cho xem nhanh */
  onlyMain?: boolean;
}

/** Không làm gì: dùng khi chỉ xem. */
const ignoreAnswerChange = () => {};

/**
 * Vẽ các phần của lá đơn. Số thứ tự phần giữ theo cả loại đơn, kể cả khi chỉ vẽ phần nội dung chính.
 * @returns  danh sách khung, mỗi phần một khung
 */
export function FormSections({
  sections,
  answers,
  onAnswerChange = ignoreAnswerChange,
  questionErrors = {},
  readOnly = false,
  onlyMain = false,
}: FormSectionsProps) {
  const shownSections = sections
    .map((section, index) => ({ section, number: index + 1 }))
    .filter(({ section }) => !onlyMain || section.main);

  return (
    <div className={styles.sections}>
      {shownSections.map(({ section, number }) => (
        <section key={section.id} className={styles.section} aria-labelledby={`section-${section.id}`}>
          <div className={styles.sectionHead}>
            <span className={styles.sectionNumber} aria-hidden="true">
              {number}
            </span>
            <h2 id={`section-${section.id}`}>{section.title || 'Phần chưa có tên'}</h2>
          </div>
          {section.hint && <p className={`${styles.hint} ${styles.sectionHint}`}>{section.hint}</p>}
          {section.questions.map((question) => (
            <QuestionBlock
              key={question.id}
              question={question}
              answerValue={answers[question.id]}
              onAnswerChange={onAnswerChange}
              readOnly={readOnly}
              error={readOnly ? undefined : questionErrors[question.id]}
            />
          ))}
        </section>
      ))}
    </div>
  );
}

/**
 * Cuộn tới câu hỏi bị lỗi đầu tiên (theo thứ tự trên trang) và đưa con trỏ vào ô trả lời của câu đó.
 * @param questionErrors  lỗi theo id câu hỏi
 */
export function focusFirstError(questionErrors: Record<string, string>): void {
  const firstQuestion = Array.from(document.querySelectorAll<HTMLElement>('[data-question-id]')).find(
    (element) => element.dataset.questionId! in questionErrors,
  );
  if (!firstQuestion) return;
  firstQuestion.scrollIntoView({ block: 'center', behavior: 'smooth' });
  firstQuestion
    // ô trả lời đầu tiên; bảng chưa có dòng nào thì không có ô nhập, con trỏ vào nút "+ Thêm …"
    .querySelector<HTMLElement>('[aria-invalid="true"], input:not([type=hidden]):not([hidden]), textarea, select, [tabindex="0"], button')
    ?.focus({ preventScroll: true });
}
