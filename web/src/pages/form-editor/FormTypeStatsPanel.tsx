/* Thẻ Thống kê ở trình soạn loại đơn: thống kê câu trả lời các đơn đã nộp của loại đơn, kiểu Google Form.
   - Thanh lọc gọn: nút Bộ lọc, câu tóm tắt điều kiện, số đơn được thống kê. Nút Bộ lọc mở hộp chọn phiên bản (Tất cả hoặc một phiên bản đã phát hành),
     khoảng ngày nộp, trạng thái (bấm nhiều nút được); đổi đến đâu thống kê tải lại đến đó.
     Điều kiện chỉ quyết định đơn nào được đếm; máy chủ chia nhóm biểu đồ (business-rules/form-types--answer-stats.ts).
   - Mỗi phần một thẻ, mỗi câu hỏi một khối, vẽ theo loại câu hỏi:
     Chọn một, Danh sách thả xuống: vành khuyên · Chọn nhiều: cột ngang (phần trăm trên số đơn trả lời) ·
     Số: nhỏ nhất / trung bình / lớn nhất + cột đứng · Ngày: sớm nhất / muộn nhất + cột đứng ·
     Trả lời ngắn: câu trả lời gộp câu trùng · Đoạn văn: câu trả lời mới nhất kèm mã đơn · Tải tệp: số tệp theo đuôi ·
     Bảng nhiều dòng: mỗi cột thống kê như câu hỏi cùng kiểu.
   - Câu chỉ có ở một số phiên bản thì ghi "Chỉ có ở phiên bản …" và chỉ tính đơn của các phiên bản đó. */
import { useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Link } from 'react-router';
import {
  ANSWER_STATS_TEXT_LIMIT,
  DEFAULT_FORM_TYPE_STATS_QUERY,
  FORM_STATUSES,
  FORM_STATUS_LABEL,
  FORM_TYPE_STATUS_LABEL,
  QUESTION_TYPE_LABEL,
  TABLE_COLUMN_TYPE_LABEL,
  type AnswerStatsOf,
  type CountedLabel,
  type FormStatus,
  type FormTypeStatsQuery,
  type FormTypeVersion,
  type QuestionStats,
  type TableColumnStats,
} from '@ulaw/shared';
import { useFormTypeAnswerStats } from '../../api/form-types';
import { formPath, type ReturnState } from '../../app/paths';
import { Button } from '../../components/Button';
import { DateInput } from '../../components/DateInput';
import { CHART_COLOR_COUNT, DonutChart, percentText, sliceColorClass } from '../../components/DonutChart';
import { LoadError, loadErrorMessage } from '../../components/LoadError';
import { Modal } from '../../components/Modal';
import { RefreshButton } from '../../components/RefreshButton';
import { FilterIcon } from '../../components/table/icons';
import { formatDate, isIsoDate } from '../../lib/format';
import styles from './FormTypeStats.module.css';

/** Giá trị ô chọn phiên bản khi thống kê mọi phiên bản. */
const ALL_VERSIONS = 'all';

/** Số câu Trả lời ngắn hiện sẵn; còn lại bấm "Xem thêm". */
const TEXT_SHOWN_COUNT = 4;
/** Số câu Đoạn văn hiện sẵn; còn lại bấm "Xem thêm". */
const PARAGRAPH_SHOWN_COUNT = 3;

/**
 * Ghi số kiểu Việt Nam, tối đa 1 chữ số lẻ (vd 7,4).
 * @param amount  số
 * @returns       chữ
 */
const numberText = (amount: number): string => amount.toLocaleString('vi-VN', { maximumFractionDigits: 1 });

/**
 * Ngày người dùng gõ có dùng được làm điều kiện không.
 * @param typedDay  chữ trong ô ngày: rỗng, ngày đủ 'YYYY-MM-DD', hoặc ngày gõ dở
 * @returns         ngày đủ thì chính ngày đó; rỗng thì null; gõ dở thì undefined
 */
function typedDayOf(typedDay: string): string | null | undefined {
  if (!typedDay) return null;
  return isIsoDate(typedDay) ? typedDay : undefined;
}

/**
 * Thẻ Thống kê của một loại đơn.
 * @param formTypeId  mã loại đơn (đã lưu)
 * @param versions    các phiên bản của loại đơn, mới nhất trước (phiên bản Nháp không có đơn nên không có trong ô chọn)
 * @returns           thẻ lọc và các thẻ phần
 */
export function FormTypeStatsPanel({ formTypeId, versions }: { formTypeId: string; versions: readonly FormTypeVersion[] }) {
  const releasedVersions = versions.filter((version) => version.status !== 'draft');
  const [versionChoice, setVersionChoice] = useState<string>(ALL_VERSIONS);
  const [typedFrom, setTypedFrom] = useState('');
  const [typedTo, setTypedTo] = useState('');
  const [statuses, setStatuses] = useState<FormStatus[]>([]);
  const [filterOpen, setFilterOpen] = useState(false);

  // Điều kiện gửi lên: ngày gõ dở hoặc khoảng ngày ngược thì giữ điều kiện hợp lệ gần nhất
  const submittedFrom = typedDayOf(typedFrom);
  const submittedTo = typedDayOf(typedTo);
  const reversedDates = Boolean(submittedFrom && submittedTo && submittedFrom > submittedTo);
  const lastValidDates = useRef<Pick<FormTypeStatsQuery, 'submittedFrom' | 'submittedTo'>>(DEFAULT_FORM_TYPE_STATS_QUERY);
  if (submittedFrom !== undefined && submittedTo !== undefined && !reversedDates) lastValidDates.current = { submittedFrom, submittedTo };
  const query: FormTypeStatsQuery = {
    version: versionChoice === ALL_VERSIONS ? 'all' : Number(versionChoice),
    ...lastValidDates.current,
    statuses: FORM_STATUSES.filter((status) => statuses.includes(status)),
  };
  const statsQuery = useFormTypeAnswerStats(formTypeId, query, releasedVersions.length > 0);
  const stats = statsQuery.data;
  const errorMessage = loadErrorMessage(statsQuery);

  /**
   * Bấm một nút trạng thái: bật / tắt trạng thái đó; "Tất cả" thì bỏ hết.
   * @param status  trạng thái; null = nút "Tất cả"
   */
  const toggleStatus = (status: FormStatus | null) =>
    setStatuses((current) => (status === null ? [] : current.includes(status) ? current.filter((item) => item !== status) : [...current, status]));

  // Chưa phát hành phiên bản nào thì chưa có đơn
  if (!releasedVersions.length) {
    return <div className={`${styles.card} ${styles.empty}`}>Loại đơn chưa phát hành phiên bản nào nên chưa có đơn để thống kê.</div>;
  }

  // Câu tóm tắt điều kiện đang dùng, vd "Phiên bản 2 · nộp từ 01/09/2026 · Đã nộp, Đang xét"
  const filterSummary = [
    query.version === 'all' ? 'Tất cả phiên bản' : `Phiên bản ${query.version}`,
    query.submittedFrom && query.submittedTo
      ? `nộp từ ${formatDate(query.submittedFrom)} đến ${formatDate(query.submittedTo)}`
      : query.submittedFrom
        ? `nộp từ ${formatDate(query.submittedFrom)}`
        : query.submittedTo
          ? `nộp đến ${formatDate(query.submittedTo)}`
          : 'mọi ngày nộp',
    query.statuses.length ? query.statuses.map((status) => FORM_STATUS_LABEL[status]).join(', ') : 'mọi trạng thái',
  ].join(' · ');
  const filterCount = (query.version === 'all' ? 0 : 1) + (query.submittedFrom || query.submittedTo ? 1 : 0) + (query.statuses.length ? 1 : 0);

  /** Bỏ mọi điều kiện: về mọi phiên bản, mọi ngày nộp, mọi trạng thái. */
  const clearFilters = () => {
    setVersionChoice(ALL_VERSIONS);
    setTypedFrom('');
    setTypedTo('');
    setStatuses([]);
  };

  const allCount = stats ? FORM_STATUSES.reduce((sum, status) => sum + stats.byStatus[status], 0) : null;
  return (
    <div className={styles.stats}>
      {/* Thanh lọc gọn: nút Bộ lọc (mở hộp chọn điều kiện) · câu tóm tắt điều kiện · số đơn, nút ↻ */}
      <section className={styles.filterBar} aria-label="Điều kiện thống kê">
        <Button onClick={() => setFilterOpen(true)}>
          <FilterIcon />
          Bộ lọc
          {filterCount ? <span className={styles.filterCount}>{filterCount}</span> : null}
        </Button>
        <span className={styles.filterSummary}>{filterSummary}</span>
        <span className={styles.total}>
          {stats ? (
            <span>
              <b>{stats.total}</b> đơn được thống kê
            </span>
          ) : null}
          <RefreshButton query={statsQuery} label="thống kê" size="small" />
        </span>
      </section>

      {/* Hộp chọn điều kiện: đổi đến đâu thống kê tải lại đến đó */}
      <Modal open={filterOpen} onClose={() => setFilterOpen(false)} title="Điều kiện thống kê">
        <div className={styles.filterFields}>
          <label className={styles.filterField}>
            Phiên bản
            <select value={versionChoice} onChange={(event) => setVersionChoice(event.target.value)}>
              <option value={ALL_VERSIONS}>Tất cả phiên bản</option>
              {releasedVersions.map((version) => (
                <option key={version.version} value={version.version}>
                  Phiên bản {version.version} · {FORM_TYPE_STATUS_LABEL[version.status]}
                </option>
              ))}
            </select>
          </label>

          <div className={styles.filterField}>
            Ngày nộp
            <span className={styles.dateRange}>
              <DateInput value={typedFrom} onValueChange={setTypedFrom} aria-label="Nộp từ ngày" />
              <span className={styles.count}>–</span>
              <DateInput value={typedTo} onValueChange={setTypedTo} aria-label="Nộp đến ngày" />
            </span>
            {reversedDates ? <span className={styles.dateError}>Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.</span> : null}
          </div>

          {/* Nút trạng thái: số đơn theo phiên bản và ngày nộp đang chọn; bấm nhiều nút được */}
          <div className={styles.filterField}>
            Trạng thái
            <div className={styles.statusChips} role="group" aria-label="Trạng thái">
              <button
                type="button"
                className={`${styles.statusChip} ${statuses.length ? '' : styles.on}`}
                aria-pressed={!statuses.length}
                onClick={() => toggleStatus(null)}
              >
                Tất cả {allCount !== null ? <b>{allCount}</b> : null}
              </button>
              {FORM_STATUSES.map((status) => {
                const isOn = statuses.includes(status);
                return (
                  <button
                    key={status}
                    type="button"
                    className={`${styles.statusChip} ${isOn ? styles.on : ''}`}
                    style={
                      {
                        '--chip-bg': `var(--s-${status}-bg)`,
                        '--chip-fg': `var(--s-${status}-fg)`,
                      } as CSSProperties
                    }
                    aria-pressed={isOn}
                    onClick={() => toggleStatus(status)}
                  >
                    <i />
                    {FORM_STATUS_LABEL[status]} {stats ? <b>{stats.byStatus[status]}</b> : null}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className={styles.dialogButtons}>
          <span className={styles.total}>
            {stats ? (
              <span>
                <b>{stats.total}</b> đơn
              </span>
            ) : null}
          </span>
          <Button variant="ghost" onClick={clearFilters} disabled={!filterCount && !typedFrom && !typedTo}>
            Bỏ lọc
          </Button>
          <Button variant="primary" onClick={() => setFilterOpen(false)}>
            Xong
          </Button>
        </div>
      </Modal>

      {/* Số liệu: lỗi · đang tải · chưa có đơn · các phần */}
      {errorMessage ? <LoadError message={errorMessage} /> : null}
      {!stats && !errorMessage ? <div className={styles.placeholder} aria-busy="true" /> : null}
      {stats && stats.total === 0 ? <div className={`${styles.card} ${styles.empty}`}>Không có đơn nào khớp điều kiện thống kê.</div> : null}
      {stats && stats.total > 0
        ? stats.sections.map((section, index) => (
            <section key={section.id} className={styles.card} aria-busy={statsQuery.isFetching}>
              <div className={styles.cardHead}>
                <span className={styles.sectionNumber}>{index + 1}</span>
                <h2>{section.title || 'Phần chưa có tiêu đề'}</h2>
              </div>
              <div className={styles.questions}>
                {section.questions.map((question) => (
                  <QuestionBlock key={question.id} question={question} />
                ))}
              </div>
            </section>
          ))
        : null}
    </div>
  );
}

/**
 * Khối thống kê một câu hỏi: tên, loại, số đơn trả lời và hình theo loại câu hỏi.
 * @param question  thống kê câu hỏi
 * @returns         khối câu hỏi
 */
function QuestionBlock({ question }: { question: QuestionStats }) {
  return (
    <article className={styles.question}>
      <div className={styles.questionHead}>
        <h3>
          {question.label || 'Câu hỏi chưa có nội dung'}
          {question.required ? (
            <span className={styles.required} aria-label="bắt buộc">
              *
            </span>
          ) : null}
        </h3>
        {question.onlyInVersions ? <span className={`${styles.chip} ${styles.chipOld}`}>Chỉ có ở phiên bản {question.onlyInVersions.join(', ')}</span> : null}
        <span className={styles.chip}>{QUESTION_TYPE_LABEL[question.type]}</span>
        <span className={styles.answered}>
          <b>{question.answered}</b> / {question.formCount} đơn trả lời
        </span>
      </div>
      {question.answered ? <QuestionBody question={question} /> : <p className={styles.noAnswer}>Chưa có câu trả lời.</p>}
    </article>
  );
}

/**
 * Hình thống kê theo loại câu hỏi.
 * @param question  thống kê câu hỏi (đã có ít nhất một câu trả lời)
 * @returns         vành khuyên, cột ngang, cột đứng, danh sách câu trả lời…
 */
function QuestionBody({ question }: { question: QuestionStats }): ReactNode {
  const { stats } = question;
  switch (stats.kind) {
    case 'options':
      return question.type === 'check' ? <OptionBars options={stats.options} base={question.answered} /> : <OptionDonut options={stats.options} />;
    case 'number':
      return <NumberSummary stats={stats} />;
    case 'date':
      return <DateSummary stats={stats} />;
    case 'text':
      return <TextAnswers stats={stats} />;
    case 'para':
      return <ParagraphAnswers stats={stats} answered={question.answered} />;
    case 'file':
      return <FileSummary stats={stats} answered={question.answered} />;
    case 'table':
      return <TableSummary stats={stats} answered={question.answered} />;
  }
}

/**
 * Vành khuyên và chú thích của câu Chọn một / Danh sách thả xuống; rê chuột lên lát hoặc dòng chú thích thì làm nổi lát đó.
 * @param options  số lần mỗi lựa chọn được chọn
 * @returns        hình và chú thích
 */
function OptionDonut({ options }: { options: CountedLabel[] }) {
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const total = options.reduce((sum, option) => sum + option.count, 0);
  const slices = options.map((option, index) => ({
    key: String(index),
    name: option.label,
    count: option.count,
    share: total ? option.count / total : 0,
    colorIndex: (index % CHART_COLOR_COUNT) + 1,
  }));

  return (
    <div className={styles.donutBody}>
      <DonutChart slices={slices} total={total} unit="đơn" focusedKey={hoveredKey} onHover={setHoveredKey} />
      <ul className={styles.legend} onMouseLeave={() => setHoveredKey(null)}>
        {slices.map((slice) => (
          <li key={slice.key} className={`${styles.legendRow} ${slice.key === hoveredKey ? styles.focused : ''}`} onMouseEnter={() => setHoveredKey(slice.key)}>
            <i className={sliceColorClass(slice.colorIndex)} />
            <span className={styles.legendName}>{slice.name}</span>
            <span className={styles.count}>{slice.count} đơn</span>
            <span className={styles.percent}>{percentText(slice.share)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Cột ngang: mỗi lựa chọn một hàng, phần trăm trên số đơn (câu Chọn nhiều, tổng có thể quá 100%) hoặc số dòng (cột Chọn).
 * @param options  số lần mỗi lựa chọn được chọn
 * @param base     số tính phần trăm
 * @param unit     đơn vị đếm, vd "đơn", "dòng"
 * @returns        các hàng
 */
function OptionBars({ options, base, unit = 'đơn' }: { options: CountedLabel[]; base: number; unit?: string }) {
  return (
    <div className={styles.bars}>
      {options.map((option) => {
        const share = base ? option.count / base : 0;
        return (
          <div key={option.label} className={styles.barRow}>
            <span className={styles.barName}>{option.label}</span>
            <span className={styles.barTrack}>
              <span style={{ width: `${Math.min(share, 1) * 100}%` }} />
            </span>
            <span className={styles.count}>
              {option.count} {unit}
            </span>
            <span className={styles.percent}>{percentText(share)}</span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Cột đứng phân bố của câu Số, câu Ngày (nhóm do máy chủ chia).
 * @param bins  các cột theo thứ tự
 * @returns     các cột, số trên đầu cột, tên nhóm bên dưới
 */
function Histogram({ bins }: { bins: CountedLabel[] }) {
  const maxCount = Math.max(1, ...bins.map((bin) => bin.count));
  return (
    <div className={styles.histogram} role="img" aria-label={bins.map((bin) => `${bin.label}: ${bin.count}`).join(', ')}>
      {/* Nhiều cột quá bề ngang thì kéo ngang để xem (như biểu đồ cột cũ ở Quản lí đơn), không tràn ra ngoài */}
      <div className={styles.histogramScroll}>
        <div className={styles.histogramInner} style={{ '--cols': bins.length } as CSSProperties}>
          <div className={styles.histogramColumns}>
            {bins.map((bin, index) => (
              <div key={index} className={styles.histogramColumn} title={`${bin.label}: ${bin.count}`}>
                <b>{bin.count}</b>
                <span style={{ height: `${(bin.count / maxCount) * 100}%` }} />
              </div>
            ))}
          </div>
          <div className={styles.histogramLabels}>
            {bins.map((bin, index) => (
              <span key={index}>{bin.label}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Các ô số nhỏ (Nhỏ nhất / Trung bình…).
 * @param tiles      các ô: tên, giá trị
 * @param className  lớp thêm cho lưới ô
 * @returns          lưới ô
 */
function NumberTiles({ tiles, className = '' }: { tiles: [string, string][]; className?: string }) {
  return (
    <div className={`${styles.numberTiles} ${className}`}>
      {tiles.map(([label, value]) => (
        <div key={label} className={styles.numberTile}>
          <span>{label}</span>
          <b>{value}</b>
        </div>
      ))}
    </div>
  );
}

/** Câu Số, cột Số: ba ô Nhỏ nhất / Trung bình / Lớn nhất và cột đứng. */
function NumberSummary({ stats }: { stats: AnswerStatsOf<'number'> }) {
  if (stats.min === null || stats.average === null || stats.max === null) return null;
  return (
    <div className={styles.numberBody}>
      <NumberTiles
        tiles={[
          ['Nhỏ nhất', numberText(stats.min)],
          ['Trung bình', numberText(stats.average)],
          ['Lớn nhất', numberText(stats.max)],
        ]}
      />
      <Histogram bins={stats.bins} />
    </div>
  );
}

/** Câu Ngày, cột Ngày: hai ô Sớm nhất / Muộn nhất và cột đứng. */
function DateSummary({ stats }: { stats: AnswerStatsOf<'date'> }) {
  if (!stats.earliest || !stats.latest) return null;
  return (
    <div className={styles.numberBody}>
      <NumberTiles
        className={styles.dateTiles}
        tiles={[
          ['Sớm nhất', formatDate(stats.earliest)],
          ['Muộn nhất', formatDate(stats.latest)],
        ]}
      />
      <Histogram bins={stats.bins} />
    </div>
  );
}

/**
 * Danh sách hiện sẵn vài dòng đầu, bấm "Xem thêm" thì hiện hết các dòng đã tải, bấm "Ẩn bớt" thì thu lại.
 * @param items       các dòng đã dựng
 * @param shownCount  số dòng hiện sẵn
 * @param moreText    chữ của nút, theo số dòng còn ẩn
 * @param note        câu ghi chú hiện sau khi mở hết (vd chỉ hiện N câu); null = không có
 * @param className   lớp thêm cho danh sách
 * @returns           danh sách và nút Xem thêm
 */
function ExpandableList({
  items,
  shownCount,
  moreText,
  note,
  className = '',
}: {
  items: ReactNode[];
  shownCount: number;
  moreText: (hiddenCount: number) => string;
  note: string | null;
  className?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const hiddenCount = items.length - shownCount;
  return (
    <div className={styles.answerList}>
      <ul className={`${styles.answers} ${className}`}>{expanded ? items : items.slice(0, shownCount)}</ul>
      {(expanded || hiddenCount <= 0) && note ? <p className={styles.listNote}>{note}</p> : null}
      {/* Xem thêm / Ẩn bớt: bấm lần nữa thì thu về như lúc đầu */}
      {hiddenCount > 0 ? (
        <button type="button" className={styles.more} aria-expanded={expanded} onClick={() => setExpanded((open) => !open)}>
          {expanded ? 'Ẩn bớt' : moreText(hiddenCount)}
        </button>
      ) : null}
    </div>
  );
}

/** Câu Trả lời ngắn, cột Chữ: câu trả lời gộp câu trùng, nhiều trước. */
function TextAnswers({ stats }: { stats: AnswerStatsOf<'text'> }) {
  return (
    <ExpandableList
      shownCount={TEXT_SHOWN_COUNT}
      moreText={(hiddenCount) => `Xem thêm ${hiddenCount} câu trả lời khác`}
      note={
        stats.distinctCount > stats.answers.length
          ? `Chỉ hiện ${ANSWER_STATS_TEXT_LIMIT} câu trả lời gặp nhiều nhất trong ${stats.distinctCount} câu khác nhau.`
          : null
      }
      items={stats.answers.map((answer) => (
        <li key={answer.text}>
          <span className={styles.answerText}>{answer.text}</span>
          <span className={styles.times}>×{answer.count}</span>
        </li>
      ))}
    />
  );
}

/** Câu Đoạn văn: câu trả lời mới nhất, kèm mã đơn (bấm để mở đơn) và ngày nộp. */
function ParagraphAnswers({ stats, answered }: { stats: AnswerStatsOf<'para'>; answered: number }) {
  return (
    <ExpandableList
      className={styles.paragraphs}
      shownCount={PARAGRAPH_SHOWN_COUNT}
      moreText={(hiddenCount) => `Xem thêm ${hiddenCount} câu trả lời`}
      note={answered > stats.answers.length ? `Đây là ${stats.answers.length} câu trả lời mới nhất. Xem đủ ${answered} câu ở Xuất danh sách đơn.` : null}
      items={stats.answers.map((answer) => (
        <li key={answer.formCode}>
          <span className={styles.answerMeta}>
            <Link to={formPath(answer.formCode)} state={{ previousPageLabel: 'thống kê loại đơn' } satisfies ReturnState}>
              {answer.formCode}
            </Link>{' '}
            · nộp {formatDate(answer.submittedAt.slice(0, 10))}
          </span>
          <span className={styles.answerText}>{answer.text}</span>
        </li>
      ))}
    />
  );
}

/** Câu Tải tệp: tổng số tệp, trung bình mỗi đơn, tỉ lệ theo đuôi tệp. */
function FileSummary({ stats, answered }: { stats: AnswerStatsOf<'file'>; answered: number }) {
  return (
    <div className={styles.fileBody}>
      <div className={styles.numberTile}>
        <span>Tổng số tệp</span>
        <b>{stats.fileCount}</b>
      </div>
      <div className={styles.numberTile}>
        <span>Trung bình mỗi đơn</span>
        <b>{numberText(answered ? stats.fileCount / answered : 0)} tệp</b>
      </div>
      {stats.byExtension.map((extension) => (
        <div key={extension.label} className={styles.numberTile} title={`${extension.count} tệp`}>
          <span>{extension.label}</span>
          <b>{percentText(stats.fileCount ? extension.count / stats.fileCount : 0)}</b>
        </div>
      ))}
    </div>
  );
}

/** Câu Bảng nhiều dòng: số dòng, rồi mỗi cột một khối thống kê như câu hỏi cùng kiểu. */
function TableSummary({ stats, answered }: { stats: AnswerStatsOf<'table'>; answered: number }) {
  return (
    <>
      <p className={styles.tableNote}>
        {stats.rowCount} dòng trong {answered} đơn, trung bình {numberText(answered ? stats.rowCount / answered : 0)} dòng mỗi đơn. Mỗi cột thống kê như câu hỏi
        cùng loại.
      </p>
      <div className={styles.columns}>
        {stats.columns.map((column) => (
          <div key={column.label} className={styles.column}>
            <h4>
              {column.label}
              <span className={styles.chip}>Cột {TABLE_COLUMN_TYPE_LABEL[column.type]}</span>
            </h4>
            <ColumnBody column={column} />
          </div>
        ))}
      </div>
    </>
  );
}

/** Thống kê một cột bảng theo kiểu cột. */
function ColumnBody({ column }: { column: TableColumnStats }): ReactNode {
  if (!column.answered) return <p className={styles.noAnswer}>Chưa có ô nào được điền.</p>;
  const { stats } = column;
  switch (stats.kind) {
    case 'options':
      return <OptionBars options={stats.options} base={column.answered} unit="dòng" />;
    case 'number':
      return <NumberSummary stats={stats} />;
    case 'date':
      return <DateSummary stats={stats} />;
    case 'text':
      return <TextAnswers stats={stats} />;
  }
}
