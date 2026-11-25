/* Thống kê câu trả lời của một loại đơn (thẻ Thống kê ở trình soạn loại đơn): chọn đơn theo điều kiện,
   gộp cấu trúc các phiên bản, đếm câu trả lời từng câu hỏi, chia nhóm biểu đồ cột cho câu Số, câu Ngày.
   Backend (api/src/form-types) và API giả cùng dùng, chỉ khác chỗ đọc dữ liệu. */
import {
  ANSWER_STATS_PARAGRAPH_LIMIT,
  ANSWER_STATS_TEXT_LIMIT,
  type AnswerStats,
  type AnswerStatsOf,
  type CountedLabel,
  type FormTypeAnswerStats,
  type FormTypeStatsQuery,
  type QuestionStats,
  type TableColumnStats,
} from '../api-contract/form-types';
import type { AnswerableQuestion, TableColumn } from '../aux-schema/form-types--question-types';
import type { FormSection } from '../aux-schema/form-types--sections';
import { isAnswerable, type AnswerValue, type FormAnswers, type TableCell } from '../aux-schema/forms--answers';
import { FORM_STATUSES, type FormStatus } from '../aux-schema/forms--statuses';
import { RichTextDocSchema, richTextToPlainText } from '../aux-schema/rich-text';
import { selectFormsForList } from './exports--form-list';

/* ---------- Dữ liệu đầu vào ---------- */

/** Một phiên bản đã từng mở của loại đơn: số phiên bản và cấu trúc các phần. */
export interface StatsVersionSource {
  version: number;
  sections: FormSection[];
}

/** Phần của một lá đơn cần để thống kê. */
export interface StatsFormSource {
  code: string;
  /** Phiên bản lúc nộp */
  version: number;
  status: FormStatus;
  /** Lúc nộp, giờ Việt Nam 'YYYY-MM-DDTHH:mm' */
  submittedAt: string;
  answers: FormAnswers;
}

/* ---------- Chia nhóm biểu đồ cột ---------- */

/** Số nhóm nhiều nhất khi chia đều câu Số. */
const NUMBER_BIN_LIMIT = 8;
/** Câu Số có từ ngần này giá trị khác nhau trở xuống (nguyên hay lẻ) thì mỗi giá trị một cột. */
const NUMBER_DISTINCT_LIMIT = 10;

/**
 * Ghi số kiểu Việt Nam cho tên nhóm, vd 7,5 · 1.500.000.
 * @param amount  số
 * @returns       chữ
 */
function formatStatsNumber(amount: number): string {
  return amount.toLocaleString('vi-VN', { maximumFractionDigits: 6 });
}

/**
 * Bỏ sai số dấu phẩy động sau khi cộng, nhân (vd 0.1 + 0.2).
 * @param amount  số
 * @returns       số đã làm tròn tới 10 chữ số thập phân
 */
function roundFloat(amount: number): number {
  return Math.round(amount * 1e10) / 1e10;
}

/**
 * Độ rộng nhóm tròn (…, 0,5, 1, 2, 5, 10, 20…) nhỏ nhất để chia [min, max] thành không quá NUMBER_BIN_LIMIT nhóm,
 * mốc đầu là bội của độ rộng.
 * @param min          giá trị nhỏ nhất
 * @param max          giá trị lớn nhất
 * @param allIntegers  mọi giá trị là số nguyên (khi đó độ rộng ít nhất là 1)
 * @returns            độ rộng nhóm
 */
function niceBinWidth(min: number, max: number, allIntegers: boolean): number {
  // Bắt đầu thử từ bậc nhỏ hơn khoảng giá trị / số nhóm một bậc, tăng dần 1 → 2 → 5 → 10…
  const range = max - min;
  let exponent = range > 0 ? Math.floor(Math.log10(range / NUMBER_BIN_LIMIT)) - 1 : 0;
  if (allIntegers) exponent = Math.max(exponent, 0);

  for (;;) {
    for (const step of [1, 2, 5]) {
      const width = roundFloat(step * 10 ** exponent);
      const start = Math.floor(roundFloat(min / width)) * width;
      if (Math.floor(roundFloat((max - start) / width)) + 1 <= NUMBER_BIN_LIMIT) return width;
    }
    exponent += 1;
  }
}

/**
 * Chia các câu trả lời Số thành các cột biểu đồ.
 * Không quá 10 giá trị khác nhau (nguyên hay lẻ): mỗi giá trị một cột.
 * Còn lại: chia đều tối đa 8 nhóm, độ rộng tròn, mốc đầu là bội của độ rộng (vd 0–4, 5–9… hoặc 5–6, 6–7…).
 * @param values  các câu trả lời
 * @returns       các cột theo thứ tự tăng dần, kể cả nhóm 0 ở giữa; không có câu trả lời thì []
 */
export function numberBins(values: readonly number[]): CountedLabel[] {
  if (!values.length) return [];

  // Ít giá trị: mỗi giá trị một cột
  const distinctValues = [...new Set(values)].sort((first, second) => first - second);
  const allIntegers = values.every(Number.isInteger);
  if (distinctValues.length <= NUMBER_DISTINCT_LIMIT) {
    return distinctValues.map((distinct) => ({ label: formatStatsNumber(distinct), count: values.filter((value) => value === distinct).length }));
  }

  // Chia đều: độ rộng tròn, mốc đầu là bội của độ rộng
  const min = distinctValues[0]!;
  const max = distinctValues[distinctValues.length - 1]!;
  const width = niceBinWidth(min, max, allIntegers);
  const start = roundFloat(Math.floor(roundFloat(min / width)) * width);
  const binCount = Math.floor(roundFloat((max - start) / width)) + 1;

  // Đếm từng nhóm; nhóm số nguyên ghi hai đầu (0–4), nhóm số lẻ ghi mốc đầu và mốc sau (5–6 = từ 5 tới dưới 6)
  const counts = new Array<number>(binCount).fill(0);
  for (const value of values) counts[Math.min(binCount - 1, Math.floor(roundFloat((value - start) / width)))]! += 1;
  return counts.map((count, index) => {
    const binStart = roundFloat(start + index * width);
    const binEnd = allIntegers ? binStart + width - 1 : roundFloat(binStart + width);
    return { label: `${formatStatsNumber(binStart)}–${formatStatsNumber(binEnd)}`, count };
  });
}

/**
 * Cộng thêm ngày vào một ngày 'YYYY-MM-DD'.
 * @param day   ngày
 * @param days  số ngày cộng thêm
 * @returns     ngày mới 'YYYY-MM-DD'
 */
function addDays(day: string, days: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * Cùng ngày sau một số tháng, chỉ để so sánh chuỗi (vd 31/01 + 1 tháng = '2026-02-31', vẫn so đúng).
 * @param day     ngày 'YYYY-MM-DD'
 * @param months  số tháng cộng thêm
 * @returns       chuỗi 'YYYY-MM-DD'
 */
function sameDayMonthsLater(day: string, months: number): string {
  const monthIndex = Number(day.slice(0, 4)) * 12 + Number(day.slice(5, 7)) - 1 + months;
  return `${Math.floor(monthIndex / 12)}-${String((monthIndex % 12) + 1).padStart(2, '0')}-${day.slice(8, 10)}`;
}

/**
 * Thứ Hai của tuần có ngày này.
 * @param day  ngày 'YYYY-MM-DD'
 * @returns    thứ Hai 'YYYY-MM-DD'
 */
function mondayOf(day: string): string {
  const weekday = new Date(`${day}T00:00:00Z`).getUTCDay();
  return addDays(day, -((weekday + 6) % 7));
}

/** Tên nhóm theo ngày, theo tuần: 'dd/mm'. */
const dayMonthLabel = (day: string) => `${day.slice(8, 10)}/${day.slice(5, 7)}`;

/** Một cách chia nhóm ngày: nhóm của một ngày, nhóm kế tiếp, tên nhóm. */
interface DateGrouping {
  /** Ngày đầu của nhóm chứa ngày này */
  groupStart: (day: string) => string;
  /** Ngày đầu của nhóm kế tiếp */
  nextStart: (groupStart: string) => string;
  /** Tên nhóm, vd '05/11', 'T6/26', '2026' */
  label: (groupStart: string) => string;
}

/** Nhóm theo ngày, theo tuần (tuần lịch, bắt đầu thứ Hai; cột ghi ngày thứ Hai), theo tháng, theo năm. */
const DATE_GROUPINGS: Record<'day' | 'week' | 'month' | 'year', DateGrouping> = {
  day: { groupStart: (day) => day, nextStart: (day) => addDays(day, 1), label: dayMonthLabel },
  week: { groupStart: mondayOf, nextStart: (day) => addDays(day, 7), label: dayMonthLabel },
  month: {
    groupStart: (day) => `${day.slice(0, 7)}-01`,
    nextStart: (day) => sameDayMonthsLater(day, 1),
    label: (day) => `T${Number(day.slice(5, 7))}/${day.slice(2, 4)}`,
  },
  year: { groupStart: (day) => `${day.slice(0, 4)}-01-01`, nextStart: (day) => `${Number(day.slice(0, 4)) + 1}-01-01`, label: (day) => day.slice(0, 4) },
};

/**
 * Chia các câu trả lời Ngày thành các cột biểu đồ theo khoảng từ ngày sớm nhất tới ngày muộn nhất:
 * dưới 2 tuần theo ngày · dưới 2 tháng theo tuần (bắt đầu thứ Hai) · dưới 2 năm theo tháng (T6/26) · từ 2 năm theo năm.
 * @param days  các câu trả lời 'YYYY-MM-DD'
 * @returns     các cột từ cũ tới mới, kể cả nhóm 0 ở giữa; không có câu trả lời thì []
 */
export function dateBins(days: readonly string[]): CountedLabel[] {
  if (!days.length) return [];

  // Chọn cách chia theo khoảng ngày
  const sortedDays = [...days].sort();
  const earliest = sortedDays[0]!;
  const latest = sortedDays[sortedDays.length - 1]!;
  const grouping =
    latest < addDays(earliest, 14)
      ? DATE_GROUPINGS.day
      : latest < sameDayMonthsLater(earliest, 2)
        ? DATE_GROUPINGS.week
        : latest < sameDayMonthsLater(earliest, 24)
          ? DATE_GROUPINGS.month
          : DATE_GROUPINGS.year;

  // Đếm theo nhóm, rồi đi lần lượt từ nhóm đầu tới nhóm cuối để giữ cả nhóm 0
  const countByGroup = new Map<string, number>();
  for (const day of sortedDays) {
    const groupStart = grouping.groupStart(day);
    countByGroup.set(groupStart, (countByGroup.get(groupStart) ?? 0) + 1);
  }
  const bins: CountedLabel[] = [];
  for (let groupStart = grouping.groupStart(earliest); groupStart <= latest; groupStart = grouping.nextStart(groupStart)) {
    bins.push({ label: grouping.label(groupStart), count: countByGroup.get(groupStart) ?? 0 });
  }
  return bins;
}

/* ---------- Đọc câu trả lời ---------- */

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Chữ của câu trả lời ngắn / ô chữ, bỏ khoảng trắng thừa.
 * @param answer  câu trả lời đã lưu
 * @returns       chữ; trống hoặc không phải chữ thì null
 */
function textOf(answer: AnswerValue | undefined): string | null {
  if (typeof answer !== 'string') return null;
  const text = answer.trim().replace(/\s+/g, ' ');
  return text || null;
}

/**
 * Số của câu Số / ô số (ô số cũ có thể lưu dạng chữ).
 * @param answer  câu trả lời đã lưu
 * @returns       số; trống hoặc không đọc được thì null
 */
function numberOf(answer: AnswerValue | undefined): number | null {
  if (typeof answer === 'number') return Number.isFinite(answer) ? answer : null;
  if (typeof answer === 'string' && answer.trim() !== '') {
    const parsed = Number(answer.trim().replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/**
 * Ngày của câu Ngày / ô ngày.
 * @param answer  câu trả lời đã lưu
 * @returns       'YYYY-MM-DD'; trống hoặc sai dạng thì null
 */
function dayOf(answer: AnswerValue | undefined): string | null {
  return typeof answer === 'string' && DAY_PATTERN.test(answer) ? answer : null;
}

/**
 * Chữ của câu Đoạn văn (văn bản có định dạng, đơn cũ có thể là chuỗi).
 * @param answer  câu trả lời đã lưu
 * @returns       chữ thường; trống thì null
 */
function paragraphOf(answer: AnswerValue | undefined): string | null {
  if (typeof answer === 'string') return answer.trim() || null;
  const parsed = RichTextDocSchema.safeParse(answer);
  return parsed.success ? richTextToPlainText(parsed.data) || null : null;
}

/**
 * Các lựa chọn đã chọn của câu Chọn một / Chọn nhiều / Danh sách thả xuống.
 * @param answer  câu trả lời đã lưu
 * @returns       các lựa chọn; chưa chọn thì []
 */
function choicesOf(answer: AnswerValue | undefined): string[] {
  if (typeof answer === 'string') return answer ? [answer] : [];
  if (Array.isArray(answer)) return answer.filter((choice): choice is string => typeof choice === 'string' && choice !== '');
  return [];
}

/**
 * Tên các tệp đã tải lên của câu Tải tệp.
 * @param answer  câu trả lời đã lưu
 * @returns       tên tệp; chưa tải thì []
 */
function fileNamesOf(answer: AnswerValue | undefined): string[] {
  if (!Array.isArray(answer)) return [];
  return answer.flatMap((file) => (file && typeof file === 'object' && !Array.isArray(file) && 'name' in file && typeof file.name === 'string' ? [file.name] : []));
}

/**
 * Các dòng của câu Bảng nhiều dòng.
 * @param answer  câu trả lời đã lưu
 * @returns       các dòng, mỗi dòng các ô theo thứ tự cột; chưa có dòng thì []
 */
function tableRowsOf(answer: AnswerValue | undefined): TableCell[][] {
  if (!Array.isArray(answer)) return [];
  return (answer as unknown[]).filter((row): row is TableCell[] => Array.isArray(row));
}

/* ---------- Thống kê theo kiểu ---------- */

/**
 * Đếm số lần mỗi lựa chọn được chọn.
 * @param definedOptions  lựa chọn của câu hỏi, theo thứ tự soạn
 * @param chosen          mọi lựa chọn đã chọn (một đơn chọn nhiều thì có nhiều phần tử)
 * @returns               lựa chọn đã soạn (kể cả 0) rồi các giá trị khác, nhiều trước
 */
function optionStats(definedOptions: readonly string[], chosen: readonly string[]): AnswerStatsOf<'options'> {
  const countByOption = new Map<string, number>(definedOptions.map((option) => [option, 0]));
  for (const option of chosen) countByOption.set(option, (countByOption.get(option) ?? 0) + 1);
  const defined = definedOptions.map((option) => ({ label: option, count: countByOption.get(option)! }));
  const others = [...countByOption]
    .filter(([option]) => !definedOptions.includes(option))
    .map(([label, count]) => ({ label, count }))
    .sort((first, second) => second.count - first.count || first.label.localeCompare(second.label, 'vi'));
  return { kind: 'options', options: [...defined, ...others] };
}

/**
 * Nhỏ nhất, trung bình, lớn nhất và các cột biểu đồ của câu Số.
 * @param values  các câu trả lời
 * @returns       thống kê; chưa ai trả lời thì min, average, max là null
 */
function numberStats(values: readonly number[]): AnswerStatsOf<'number'> {
  if (!values.length) return { kind: 'number', min: null, average: null, max: null, bins: [] };
  return {
    kind: 'number',
    min: Math.min(...values),
    average: values.reduce((sum, value) => sum + value, 0) / values.length,
    max: Math.max(...values),
    bins: numberBins(values),
  };
}

/**
 * Sớm nhất, muộn nhất và các cột biểu đồ của câu Ngày.
 * @param days  các câu trả lời 'YYYY-MM-DD'
 * @returns     thống kê; chưa ai trả lời thì earliest, latest là null
 */
function dateStats(days: readonly string[]): AnswerStatsOf<'date'> {
  const sortedDays = [...days].sort();
  return { kind: 'date', earliest: sortedDays[0] ?? null, latest: sortedDays[sortedDays.length - 1] ?? null, bins: dateBins(sortedDays) };
}

/**
 * Gộp câu trả lời ngắn trùng nhau (không phân biệt hoa thường), nhiều trước.
 * @param texts  các câu trả lời đã bỏ khoảng trắng thừa
 * @returns      số câu khác nhau và tối đa ANSWER_STATS_TEXT_LIMIT câu nhiều nhất (giữ cách viết gặp đầu tiên)
 */
function textStats(texts: readonly string[]): AnswerStatsOf<'text'> {
  const groups = new Map<string, { text: string; count: number }>();
  for (const text of texts) {
    const key = text.toLocaleLowerCase('vi');
    const group = groups.get(key);
    if (group) group.count += 1;
    else groups.set(key, { text, count: 1 });
  }
  const answers = [...groups.values()].sort((first, second) => second.count - first.count || first.text.localeCompare(second.text, 'vi'));
  return { kind: 'text', distinctCount: answers.length, answers: answers.slice(0, ANSWER_STATS_TEXT_LIMIT) };
}

/**
 * Số tệp theo đuôi tệp.
 * @param fileNames  tên mọi tệp đã tải lên
 * @returns          tổng số tệp, số tệp theo đuôi in hoa (không có đuôi: 'Khác'), nhiều trước
 */
function fileStats(fileNames: readonly string[]): AnswerStatsOf<'file'> {
  const countByExtension = new Map<string, number>();
  for (const name of fileNames) {
    const dotIndex = name.lastIndexOf('.');
    const extension = dotIndex > 0 && dotIndex < name.length - 1 ? name.slice(dotIndex + 1).toUpperCase() : 'Khác';
    countByExtension.set(extension, (countByExtension.get(extension) ?? 0) + 1);
  }
  const byExtension = [...countByExtension]
    .map(([label, count]) => ({ label, count }))
    .sort((first, second) => second.count - first.count || first.label.localeCompare(second.label));
  return { kind: 'file', fileCount: fileNames.length, byExtension };
}

/* ---------- Gộp cấu trúc các phiên bản ---------- */

/** Một câu hỏi sau khi gộp: định nghĩa theo từng phiên bản có câu này. */
interface MergedQuestion {
  id: string;
  /** Định nghĩa của phiên bản mới nhất có câu này (tên, bắt buộc, lựa chọn…) */
  newest: AnswerableQuestion;
  /** Định nghĩa theo số phiên bản (đơn của phiên bản nào đọc theo định nghĩa của phiên bản đó) */
  byVersion: Map<number, AnswerableQuestion>;
}

interface MergedSection {
  id: string;
  title: string;
  questions: MergedQuestion[];
}

/**
 * Chen một phần tử vào ngay sau phần tử neo (phần tử đứng trước nó ở phiên bản đang xét); không có neo thì chen lên đầu.
 * @param list     danh sách đã gộp
 * @param item     phần tử mới
 * @param afterId  id phần tử neo; null = chen lên đầu
 */
function insertAfter<Item extends { id: string }>(list: Item[], item: Item, afterId: string | null): void {
  const anchorIndex = afterId === null ? -1 : list.findIndex((existing) => existing.id === afterId);
  list.splice(anchorIndex + 1, 0, item);
}

/**
 * Gộp các phần, câu hỏi của nhiều phiên bản thành một: theo thứ tự của phiên bản mới nhất,
 * phần, câu chỉ có ở phiên bản cũ chen vào sau phần, câu đứng trước nó ở phiên bản đó. Bỏ khối thông báo.
 * @param versions  các phiên bản cần gộp
 * @returns         các phần đã gộp
 */
function mergeVersionSections(versions: readonly StatsVersionSource[]): MergedSection[] {
  const merged: MergedSection[] = [];
  const questionById = new Map<string, MergedQuestion>();

  for (const { version, sections } of [...versions].sort((first, second) => second.version - first.version)) {
    let previousSectionId: string | null = null;
    for (const section of sections) {
      // Phần: có rồi thì dùng lại, chưa có thì chen sau phần đứng trước
      let mergedSection = merged.find((existing) => existing.id === section.id);
      if (!mergedSection) {
        mergedSection = { id: section.id, title: section.title, questions: [] };
        insertAfter(merged, mergedSection, previousSectionId);
      }
      previousSectionId = section.id;

      // Câu hỏi: có rồi (kể cả ở phần khác) thì thêm phiên bản, chưa có thì chen sau câu đứng trước
      let previousQuestionId: string | null = null;
      for (const question of section.questions.filter(isAnswerable)) {
        const existing = questionById.get(question.id);
        if (existing) {
          existing.byVersion.set(version, question);
        } else {
          const mergedQuestion: MergedQuestion = { id: question.id, newest: question, byVersion: new Map([[version, question]]) };
          questionById.set(question.id, mergedQuestion);
          insertAfter(mergedSection.questions, mergedQuestion, previousQuestionId);
        }
        if (mergedSection.questions.some((mergedQuestion) => mergedQuestion.id === question.id)) previousQuestionId = question.id;
      }
    }
  }
  return merged.filter((section) => section.questions.length > 0);
}

/* ---------- Thống kê từng câu hỏi ---------- */

/** Một cột bảng sau khi gộp các phiên bản (theo tên cột). */
interface MergedColumn {
  id: string;
  newest: TableColumn;
}

/**
 * Thống kê một cột của bảng nhiều dòng.
 * @param column  cột (định nghĩa mới nhất)
 * @param cells   các ô của cột này trên mọi dòng (dòng không có cột này thì không có ô)
 * @returns       số ô có điền và thống kê theo kiểu cột
 */
function tableColumnStats(column: TableColumn, cells: readonly AnswerValue[]): TableColumnStats {
  const base = { label: column.label, type: column.type };
  if (column.type === 'number') {
    const values = cells.map(numberOf).filter((value): value is number => value !== null);
    return { ...base, answered: values.length, stats: numberStats(values) };
  }
  if (column.type === 'date') {
    const days = cells.map(dayOf).filter((day): day is string => day !== null);
    return { ...base, answered: days.length, stats: dateStats(days) };
  }
  const texts = cells.map(textOf).filter((text): text is string => text !== null);
  if (column.type === 'select') return { ...base, answered: texts.length, stats: optionStats(column.options ?? [], texts) };
  return { ...base, answered: texts.length, stats: textStats(texts) };
}

/**
 * Thống kê câu Bảng nhiều dòng: gộp cột các phiên bản theo tên cột, đọc ô của mỗi đơn theo cột của phiên bản đơn đó.
 * @param merged  câu hỏi đã gộp
 * @param forms   các đơn được đếm có câu này
 * @returns       số đơn có ít nhất một dòng, thống kê bảng
 */
function tableStats(merged: MergedQuestion, forms: readonly StatsFormSource[]): { answered: number; stats: AnswerStatsOf<'table'> } {
  // Gộp cột: theo thứ tự của phiên bản mới nhất, cột chỉ có ở phiên bản cũ chen sau cột đứng trước
  const columns: MergedColumn[] = [];
  for (const [, question] of [...merged.byVersion].sort(([first], [second]) => second - first)) {
    if (question.type !== 'table') continue;
    let previousLabel: string | null = null;
    for (const column of question.columns) {
      if (!columns.some((existing) => existing.id === column.label)) insertAfter(columns, { id: column.label, newest: column }, previousLabel);
      previousLabel = column.label;
    }
  }

  // Gom ô theo tên cột, mỗi đơn đọc theo cột của phiên bản mình
  const cellsByLabel = new Map<string, AnswerValue[]>(columns.map((column) => [column.id, []]));
  let rowCount = 0;
  let answered = 0;
  for (const form of forms) {
    const rows = tableRowsOf(form.answers[merged.id]);
    if (!rows.length) continue;
    answered += 1;
    rowCount += rows.length;
    const versionQuestion = merged.byVersion.get(form.version);
    const versionColumns = versionQuestion?.type === 'table' ? versionQuestion.columns : [];
    for (const row of rows) versionColumns.forEach((column, index) => cellsByLabel.get(column.label)!.push(row[index] ?? null));
  }
  return {
    answered,
    stats: { kind: 'table', rowCount, columns: columns.map((column) => tableColumnStats(column.newest, cellsByLabel.get(column.id)!)) },
  };
}

/**
 * Thống kê một câu hỏi trên các đơn có câu này.
 * @param merged  câu hỏi đã gộp
 * @param forms   các đơn được đếm thuộc phiên bản có câu này
 * @returns       số đơn có trả lời và thống kê theo loại câu hỏi
 */
function answerStatsOf(merged: MergedQuestion, forms: readonly StatsFormSource[]): { answered: number; stats: AnswerStats } {
  const question = merged.newest;
  const answers = forms.map((form) => form.answers[merged.id]);

  switch (question.type) {
    case 'number': {
      const values = answers.map(numberOf).filter((value): value is number => value !== null);
      return { answered: values.length, stats: numberStats(values) };
    }
    case 'date': {
      const days = answers.map(dayOf).filter((day): day is string => day !== null);
      return { answered: days.length, stats: dateStats(days) };
    }
    case 'text': {
      const texts = answers.map(textOf).filter((text): text is string => text !== null);
      return { answered: texts.length, stats: textStats(texts) };
    }
    case 'para': {
      // Câu trả lời mới nhất trước
      const answered = forms
        .map((form) => ({ formCode: form.code, submittedAt: form.submittedAt, text: paragraphOf(form.answers[merged.id]) }))
        .filter((answer): answer is { formCode: string; submittedAt: string; text: string } => answer.text !== null)
        .sort((first, second) => second.submittedAt.localeCompare(first.submittedAt) || second.formCode.localeCompare(first.formCode));
      return { answered: answered.length, stats: { kind: 'para', answers: answered.slice(0, ANSWER_STATS_PARAGRAPH_LIMIT) } };
    }
    case 'radio':
    case 'select':
    case 'check': {
      const choicesPerForm = answers.map(choicesOf);
      return { answered: choicesPerForm.filter((choices) => choices.length).length, stats: optionStats(question.options, choicesPerForm.flat()) };
    }
    case 'file': {
      const namesPerForm = answers.map(fileNamesOf);
      return { answered: namesPerForm.filter((names) => names.length).length, stats: fileStats(namesPerForm.flat()) };
    }
    case 'table':
      return tableStats(merged, forms);
  }
}

/* ---------- Thống kê cả loại đơn ---------- */

/**
 * Thống kê câu trả lời của một loại đơn theo điều kiện của thẻ Thống kê.
 * @param versions  các phiên bản đã từng mở của loại đơn (bản nháp chưa có đơn nào)
 * @param forms     mọi lá đơn của loại đơn
 * @param query     điều kiện: phiên bản, khoảng ngày nộp, trạng thái
 * @returns         số đơn, số đơn theo trạng thái và thống kê từng câu hỏi; phiên bản chọn không có thì null (404)
 */
export function computeFormTypeAnswerStats(
  versions: readonly StatsVersionSource[],
  forms: readonly StatsFormSource[],
  query: FormTypeStatsQuery,
): FormTypeAnswerStats | null {
  // Phiên bản đang thống kê
  const chosenVersions = query.version === 'all' ? versions : versions.filter(({ version }) => version === query.version);
  if (!chosenVersions.length) return null;
  const chosenNumbers = new Set(chosenVersions.map(({ version }) => version));

  // Đơn theo phiên bản, ngày nộp → đếm theo trạng thái → lọc trạng thái
  const datedForms = selectFormsForList(forms, query).filter((form) => chosenNumbers.has(form.version));
  const byStatus = Object.fromEntries(FORM_STATUSES.map((status) => [status, datedForms.filter((form) => form.status === status).length])) as Record<FormStatus, number>;
  const countedForms = query.statuses.length ? datedForms.filter((form) => query.statuses.includes(form.status)) : datedForms;

  // Từng câu hỏi: chỉ tính đơn của phiên bản có câu này
  const sections = mergeVersionSections(chosenVersions).map((section) => ({
    id: section.id,
    title: section.title,
    questions: section.questions.map((merged): QuestionStats => {
      const questionForms = countedForms.filter((form) => merged.byVersion.has(form.version));
      const { answered, stats } = answerStatsOf(merged, questionForms);
      const questionVersions = [...merged.byVersion.keys()].sort((first, second) => first - second);
      return {
        id: merged.id,
        label: merged.newest.label,
        type: merged.newest.type,
        required: merged.newest.required,
        answered,
        formCount: questionForms.length,
        onlyInVersions: questionVersions.length < chosenVersions.length ? questionVersions : null,
        stats,
      };
    }),
  }));

  return { total: countedForms.length, byStatus, sections };
}
