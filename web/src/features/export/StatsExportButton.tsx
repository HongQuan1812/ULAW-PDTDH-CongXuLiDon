/* Nút "Xuất thống kê" ở đầu trình soạn loại đơn. Bấm nút thì mở hộp "Xuất thống kê" để chọn điều kiện:
   - Phiên bản: một phiên bản (mặc định là phiên bản đang xem) hoặc Tất cả (mỗi phiên bản một sheet, đều là bản sao cấu trúc của mẫu)
   - Ngày nộp: từ ngày nào đến ngày nào (bỏ trống = không giới hạn)
   Dưới đó là các mẫu thống kê ĐÃ LƯU, mỗi mẫu một dòng tự so mã trong mẫu với câu hỏi của phiên bản được chọn (đỏ khi có mã không khớp,
   xanh khi khớp hết), rồi bấm "Xuất" ở mẫu muốn dùng. Mã nào phiên bản đó không có thì ô để trống.
   File Excel nhận về mở trong trình xem, có nút "Tải file Excel" trên thanh xem. */
import { useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import { questionExportTags, type ExportTemplate, type FormTypeVersion } from '@ulaw/shared';
import { checkExportTemplate, exportStats, useExportTemplates } from '../../api/exports';
import { Button } from '../../components/Button';
import { DateInput } from '../../components/DateInput';
import { Modal } from '../../components/Modal';
import { useToast } from '../../components/Toast';
import { isIsoDate } from '../../lib/format';
import { FilePreview, type PreviewFile } from '../file-preview/FilePreview';
import { checkFailureOf, checkResultOf, type TemplateResult } from './checkResult';
import styles from './ExportButton.module.css';

/** Ghi chú trên thanh xem: bản xem chỉ có chữ trong ô, file tải về mới đủ định dạng. */
export const XLSX_PREVIEW_NOTE = 'Xem trước gần đúng · chỉ hiện chữ trong ô';

/** Giá trị ô chọn phiên bản khi xuất mọi phiên bản. */
const ALL_VERSIONS = 'all';

/**
 * Ngày người dùng gõ có dùng được làm điều kiện không.
 * @param typedDay  chữ trong ô ngày: rỗng, ngày đủ 'YYYY-MM-DD', hoặc ngày gõ dở
 * @returns         ngày đủ thì chính ngày đó; rỗng thì null; gõ dở thì undefined
 */
function dayOf(typedDay: string): string | null | undefined {
  if (!typedDay) return null;
  return isIsoDate(typedDay) ? typedDay : undefined;
}

/**
 * Nút Xuất thống kê của một loại đơn.
 * @param formTypeId     mã loại đơn (đã lưu)
 * @param prefix         tiền tố mã đơn (để gửi kèm lúc kiểm tra mã)
 * @param versions       các phiên bản đã lưu của loại đơn
 * @param viewedVersion  phiên bản đang xem ở trình soạn: mặc định của ô chọn phiên bản
 * @param className      lớp CSS thêm cho nút
 * @returns              nút, hộp chọn điều kiện và mẫu, trình xem file đã điền
 */
export function StatsExportButton({
  formTypeId,
  prefix,
  versions,
  viewedVersion,
  className,
}: {
  formTypeId: string;
  prefix: string;
  versions: readonly FormTypeVersion[];
  viewedVersion: number;
  className?: string;
}) {
  const toast = useToast();
  const templatesQuery = useExportTemplates(formTypeId);
  const templates = (templatesQuery.data ?? []).filter((template) => template.purpose === 'stats');

  // Bản nháp chưa có đơn nào nên không xuất được; các phiên bản còn lại, cũ trước
  const exportableVersions = versions.filter((version) => version.status !== 'draft').sort((first, second) => first.version - second.version);
  const defaultChoice = exportableVersions.some((version) => version.version === viewedVersion) ? String(viewedVersion) : ALL_VERSIONS;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [versionChoice, setVersionChoice] = useState(defaultChoice);
  const [typedFrom, setTypedFrom] = useState('');
  const [typedTo, setTypedTo] = useState('');
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [exportedFile, setExportedFile] = useState<PreviewFile | null>(null);

  // Điều kiện hợp lệ: ngày gõ dở hoặc ngày bắt đầu sau ngày kết thúc thì chưa xuất được
  const submittedFrom = dayOf(typedFrom);
  const submittedTo = dayOf(typedTo);
  const dayProblem =
    submittedFrom === undefined || submittedTo === undefined
      ? 'Nhập ngày đủ dạng ngày/tháng/năm, hoặc xóa trống.'
      : submittedFrom && submittedTo && submittedFrom > submittedTo
        ? 'Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.'
        : '';

  // Các phiên bản được chọn, để đối chiếu mã theo câu hỏi của từng phiên bản
  const chosenVersions = versionChoice === ALL_VERSIONS ? exportableVersions : exportableVersions.filter((version) => String(version.version) === versionChoice);
  const checkPairs = templates.flatMap((template) => chosenVersions.map((version) => ({ template, version })));
  const checks = useQueries({
    queries: checkPairs.map(({ template, version }) => ({
      queryKey: ['export-check-stats', formTypeId, template.id, template.uploadedAt, version.version, version.updatedAt],
      queryFn: async (): Promise<TemplateResult> => {
        try {
          const check = await checkExportTemplate(formTypeId, template.id, { name: version.name, prefix, sections: version.sections });
          const tableTags = questionExportTags(version.sections)
            .filter((question) => question.columns)
            .map((question) => question.tag);
          return checkResultOf(check, tableTags, 'phiên bản này');
        } catch (error) {
          return checkFailureOf(error);
        }
      },
      enabled: dialogOpen,
      staleTime: 0,
    })),
  });

  /** Mở hộp: đặt lại ô phiên bản theo phiên bản đang xem lúc bấm. */
  const openDialog = () => {
    setVersionChoice(defaultChoice);
    setDialogOpen(true);
  };

  /**
   * Xuất theo một mẫu thống kê: xong thì đóng hộp, mở trình xem file Excel đã điền; lỗi thì báo câu máy chủ gửi.
   * @param template  mẫu đã chọn
   */
  const exportWith = async (template: ExportTemplate) => {
    if (submittedFrom === undefined || submittedTo === undefined) return;
    setExportingId(template.id);
    try {
      const exported = await exportStats(formTypeId, template.id, {
        version: versionChoice === ALL_VERSIONS ? ALL_VERSIONS : Number(versionChoice),
        submittedFrom,
        submittedTo,
      });
      setDialogOpen(false);
      setExportedFile({
        id: `export-stats-${formTypeId}-${template.id}-${Date.now()}`,
        name: exported.fileName,
        sizeBytes: exported.content.size,
        content: exported.content,
        title: `Thống kê · ${template.name}`,
        note: XLSX_PREVIEW_NOTE,
        downloadLabel: 'Tải file Excel',
      });
    } catch (error) {
      toast(error instanceof Error ? error.message : String(error), 'error');
    } finally {
      setExportingId(null);
    }
  };

  const cannotOpen = !templates.length || !exportableVersions.length;
  return (
    <>
      <Button
        className={className}
        aria-haspopup="dialog"
        disabled={cannotOpen}
        title={
          cannotOpen
            ? 'Chưa có mẫu thống kê. Bấm nút tròn “Mẫu xuất file thống kê” ở cạnh phải, thêm file Excel rồi bấm Lưu.'
            : 'Chọn phiên bản, ngày nộp và mẫu để xem, tải file Excel thống kê'
        }
        onClick={openDialog}
      >
        {/* biểu tượng bảng tính */}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M3 9h18M3 15h18M9 3v18" />
        </svg>
        Xuất thống kê
      </Button>

      <Modal open={dialogOpen} onClose={() => setDialogOpen(false)} title="Xuất thống kê" showCloseButton className={styles.dialog}>
        <div className={styles.filters}>
          <label className={styles.filterField}>
            <span>Phiên bản</span>
            <select value={versionChoice} onChange={(event) => setVersionChoice(event.target.value)}>
              <option value={ALL_VERSIONS}>Tất cả (mỗi phiên bản một sheet)</option>
              {exportableVersions.map((version) => (
                <option key={version.version} value={version.version}>
                  Phiên bản {version.version}
                </option>
              ))}
            </select>
          </label>
          <div className={styles.filterField}>
            <span>Ngày nộp</span>
            <div className={styles.dayRange}>
              <DateInput value={typedFrom} onValueChange={setTypedFrom} aria-label="Từ ngày nộp" placeholder="Từ ngày" />
              <span aria-hidden="true">–</span>
              <DateInput value={typedTo} onValueChange={setTypedTo} aria-label="Đến ngày nộp" placeholder="Đến ngày" />
            </div>
          </div>
        </div>
        {dayProblem && (
          <p className={`${styles.result} ${styles.bad}`} role="alert">
            {dayProblem}
          </p>
        )}

        <p className={styles.dialogHint}>
          Hệ thống đối chiếu mã trong mỗi mẫu với câu hỏi của {versionChoice === ALL_VERSIONS ? 'từng phiên bản' : `phiên bản ${versionChoice}`}. Mã nào phiên bản đó không có sẽ để trống.
        </p>
        <ul className={styles.templateList}>
          {templates.map((template) => (
            <li key={template.id} className={styles.templateRow}>
              <div className={styles.templateInfo}>
                <b>{template.name}</b>
                <span>{template.fileName}</span>
                {/* kết quả đối chiếu theo từng phiên bản được chọn: đỏ khi có mã không khớp, xanh khi khớp hết */}
                {checkPairs.map((pair, index) => {
                  if (pair.template.id !== template.id) return null;
                  const result = checks[index]?.data;
                  const prefixText = chosenVersions.length > 1 ? `Phiên bản ${pair.version.version}: ` : '';
                  return (
                    <p key={pair.version.version} className={`${styles.result} ${result ? (result.tone === 'bad' ? styles.bad : styles.good) : ''}`} role="status">
                      {result ? `${prefixText}${result.text}` : 'Đang đối chiếu mã…'}
                    </p>
                  );
                })}
              </div>
              <Button disabled={exportingId !== null || Boolean(dayProblem)} onClick={() => void exportWith(template)}>
                {exportingId === template.id ? 'Đang tạo…' : 'Xuất'}
              </Button>
            </li>
          ))}
        </ul>
      </Modal>

      <FilePreview file={exportedFile} onClose={() => setExportedFile(null)} />
    </>
  );
}
