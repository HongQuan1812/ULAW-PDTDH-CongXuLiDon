/* Mẫu xuất file của loại đơn (danh sách, lưu các thay đổi, mẫu gốc, kiểm tra mã), xuất file một lá đơn (mẫu Word)
   và xuất file thống kê mọi lá đơn của loại đơn (mẫu Excel).
   Đọc, kiểm tra, điền mẫu bằng các hàm của shared/ (exports--docx.ts, exports--xlsx.ts), giống hệt API giả. */
import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import {
  DOCX_CONTENT_TYPE,
  EXPORT_MESSAGES,
  EXPORT_TEMPLATE_FILE,
  FORM_COUNT_TAG,
  buildExportData,
  checkDocxTemplate,
  checkXlsxTemplate,
  explainDocxError,
  TEMPLATE_FILE_MESSAGES,
  hasTemplateExtension,
  isReadableTemplateFile,
  renderDocxTemplate,
  renderXlsxTemplate,
  templatePurposeOfFile,
  textToTag,
  type ExportSource,
  type ExportTemplate,
  type ExportTemplateCheck,
  type ExportTemplatePurpose,
  type ExportTemplatesResponse,
  type FormAnswers,
  type FormSection,
  type FormType,
  type SaveExportTemplatesRequest,
} from '@ulaw/shared';
import { ApiException } from '../common/api-exception';
import { PrismaService } from '../common/prisma.service';
import { toVietnamTime } from '../common/vietnam-time';
import { FormService } from '../form/form.service';
import type { ExportTemplate as ExportTemplateRow, Form, User } from '../generated/prisma/client';
import { StudentDirectoryService } from '../student-directory/student-directory.service';

/** Một file mẫu nhận được trong body multipart. */
export interface UploadedTemplateFile {
  /** Tên file người dùng đặt (đã đọc đúng chữ có dấu) */
  fileName: string;
  content: Buffer;
}

/** Một file (Word / Excel) trả về cho trình duyệt. */
export interface DownloadFile {
  fileName: string;
  contentType: string;
  content: Buffer;
}

/** Mẫu kèm họ tên người tải lên, đủ để dựng ExportTemplate. */
type TemplateWithUploader = ExportTemplateRow & { uploadedBy: { name: string } };

/** Lá đơn kèm người nộp, người tiếp nhận, người xử lí. */
type FormWithPeople = Form & { owner: User; receiver: User | null; handler: User | null };

/** Người liên quan cần lấy kèm lá đơn. */
const WITH_PEOPLE = { owner: true, receiver: true, handler: true } as const;


/**
 * Tên file xuất ra, không dấu (một số trình duyệt đổi tên file có dấu thành "download").
 * @param prefix        phần đầu, vd mã đơn, mã loại đơn
 * @param templateName  tên mẫu
 * @param purpose       quyết định đuôi file
 * @returns             vd 'XMM-2026-001-00001_don-gui-phong-dao-tao.docx'
 */
function exportFileName(prefix: string, templateName: string, purpose: ExportTemplatePurpose): string {
  return `${prefix}_${textToTag(templateName).replace(/_/g, '-')}${EXPORT_TEMPLATE_FILE[purpose].extension}`;
}

/**
 * Dựng ExportTemplate từ dòng trong database.
 * @param row  mẫu kèm người tải lên
 * @returns    theo ExportTemplateSchema
 */
function toTemplate(row: TemplateWithUploader): ExportTemplate {
  return {
    id: row.id,
    purpose: row.purpose,
    name: row.name,
    fileName: row.fileName,
    sizeBytes: row.sizeBytes,
    uploadedAt: toVietnamTime(row.uploadedAt),
    uploadedBy: row.uploadedBy.name,
  };
}

@Injectable()
export class ExportsService {
  /**
   * @param prisma            kết nối database
   * @param formService       lấy lá đơn người xem được phép xem
   * @param studentDirectory  MSSV chính của người nộp đơn
   */
  constructor(
    private readonly prisma: PrismaService,
    private readonly formService: FormService,
    private readonly studentDirectory: StudentDirectoryService,
  ) {}

  /**
   * Các mẫu của loại đơn (cả mẫu đơn và mẫu thống kê), theo thứ tự tải lên.
   * @param formTypeId  mã loại đơn
   * @returns           theo ExportTemplatesResponseSchema; loại đơn không có thì danh sách rỗng
   */
  async findTemplates(formTypeId: string): Promise<ExportTemplatesResponse> {
    const rows = await this.prisma.exportTemplate.findMany({
      where: { formTypeId },
      include: { uploadedBy: { select: { name: true } } },
      orderBy: [{ uploadedAt: 'asc' }, { id: 'asc' }],
    });
    return { templates: rows.map(toTemplate) };
  }

  /**
   * Báo lỗi nếu không có loại đơn (quản lí mẫu của loại đơn không có).
   * @param formTypeId  mã loại đơn
   * @throws            404 không có loại đơn
   */
  async assertFormTypeExists(formTypeId: string): Promise<void> {
    const formType = await this.prisma.formType.findUnique({ where: { id: formTypeId }, select: { id: true } });
    if (!formType) throw new ApiException(404, EXPORT_MESSAGES.formTypeNotFound);
  }

  /**
   * Lưu các thay đổi về mẫu trong một lần: kiểm tra hết trước, sai một chỗ thì không lưu gì.
   * @param formTypeId  mã loại đơn (đã biết là có)
   * @param changes     xóa, đổi tên, thêm
   * @param uploads     file của các mẫu mới theo id tạm
   * @param staff       cán bộ đang lưu
   * @returns           các mẫu sau khi lưu
   * @throws            404 mẫu cần xóa / đổi tên không còn · 422 thiếu file, sai loại file, không đọc được
   */
  async saveTemplates(
    formTypeId: string,
    changes: SaveExportTemplatesRequest,
    uploads: ReadonlyMap<string, UploadedTemplateFile>,
    staff: User,
  ): Promise<ExportTemplatesResponse> {
    // Mẫu cần xóa / đổi tên phải còn
    const savedRows = await this.prisma.exportTemplate.findMany({ where: { formTypeId }, select: { id: true } });
    const savedIds = new Set(savedRows.map((row) => row.id));
    const touchedIds = [...changes.removed, ...changes.renamed.map((rename) => rename.templateId)];
    if (touchedIds.some((templateId) => !savedIds.has(templateId))) throw new ApiException(404, EXPORT_MESSAGES.templateNotFound);

    // Mỗi mẫu mới phải có file đúng loại (.docx cho mẫu đơn, .xlsx cho mẫu thống kê) và đọc được
    const newTemplates: { name: string; purpose: ExportTemplatePurpose; upload: UploadedTemplateFile }[] = [];
    for (const added of changes.added) {
      const upload = uploads.get(added.tempId);
      if (!upload) throw new ApiException(422, EXPORT_MESSAGES.fileMissing(added.name));
      const messages = TEMPLATE_FILE_MESSAGES[added.purpose];
      if (!hasTemplateExtension(upload.fileName, added.purpose)) throw new ApiException(422, messages.wrongType);
      if (!(await isReadableTemplateFile(upload.content, added.purpose))) throw new ApiException(422, `${upload.fileName}: ${messages.unreadable}`);
      newTemplates.push({ name: added.name.trim(), purpose: added.purpose, upload });
    }

    // Lưu theo thứ tự: xóa, đổi tên, thêm (cùng một transaction); cùng giờ tải lên thì theo thứ tự gửi
    const uploadedAt = new Date();
    await this.prisma.$transaction([
      this.prisma.exportTemplate.deleteMany({ where: { formTypeId, id: { in: changes.removed } } }),
      ...changes.renamed.map(({ templateId, name }) => this.prisma.exportTemplate.update({ where: { id: templateId }, data: { name: name.trim() } })),
      ...newTemplates.map(({ name, purpose, upload }, index) =>
        this.prisma.exportTemplate.create({
          data: {
            id: `tpl-${randomUUID()}`,
            formTypeId,
            purpose,
            name,
            fileName: upload.fileName,
            sizeBytes: upload.content.byteLength,
            // Prisma nhận Uint8Array trên ArrayBuffer thường; Buffer của multer có thể nằm trên vùng nhớ dùng chung
            content: new Uint8Array(upload.content),
            uploadedAt: new Date(uploadedAt.getTime() + index),
            uploadedById: staff.id,
          },
        }),
      ),
    ]);
    return this.findTemplates(formTypeId);
  }

  /**
   * Lấy một mẫu của loại đơn.
   * @param formTypeId  mã loại đơn
   * @param templateId  id mẫu
   * @param purpose     chỉ nhận mẫu có mục đích này; bỏ trống = mẫu nào cũng được
   * @returns           mẫu kèm nội dung
   * @throws            404 mẫu không có, không thuộc loại đơn này, hoặc khác mục đích
   */
  private async loadTemplate(formTypeId: string, templateId: string, purpose?: ExportTemplatePurpose): Promise<ExportTemplateRow> {
    const row = await this.prisma.exportTemplate.findFirst({ where: { id: templateId, formTypeId, ...(purpose && { purpose }) } });
    if (!row) throw new ApiException(404, EXPORT_MESSAGES.templateNotFound);
    return row;
  }

  /**
   * Mẫu gốc còn nguyên các mã (nút Xem mẫu).
   * @param formTypeId  mã loại đơn
   * @param templateId  id mẫu
   * @returns           tên file lúc tải lên, kiểu nội dung, nội dung
   * @throws            404 mẫu không có
   */
  async findTemplateFile(formTypeId: string, templateId: string): Promise<DownloadFile> {
    const row = await this.loadTemplate(formTypeId, templateId);
    return { fileName: row.fileName, contentType: EXPORT_TEMPLATE_FILE[row.purpose].contentType, content: Buffer.from(row.content) };
  }

  /**
   * Kiểm tra mã trong một mẫu đã lưu theo bản soạn hiện tại của loại đơn.
   * @param formTypeId  mã loại đơn
   * @param templateId  id mẫu
   * @param sections    các phần của bản soạn
   * @returns           kết quả kiểm tra
   * @throws            404 mẫu không có
   */
  async checkSavedTemplate(formTypeId: string, templateId: string, sections: readonly FormSection[]): Promise<ExportTemplateCheck> {
    const row = await this.loadTemplate(formTypeId, templateId);
    return row.purpose === 'form' ? checkDocxTemplate(row.content, sections) : checkXlsxTemplate(row.content, sections);
  }

  /**
   * Kiểm tra mã trong một file mẫu chưa lưu (không lưu lại): .docx như mẫu đơn, .xlsx như mẫu thống kê.
   * @param upload    file gửi kèm
   * @param sections  các phần của bản soạn
   * @returns         kết quả kiểm tra
   * @throws          422 không phải .docx / .xlsx, hoặc không đọc được
   */
  async checkUploadedTemplate(upload: UploadedTemplateFile, sections: readonly FormSection[]): Promise<ExportTemplateCheck> {
    const purpose = templatePurposeOfFile(upload.fileName);
    if (!purpose) throw new ApiException(422, EXPORT_MESSAGES.notTemplateFile);
    if (!(await isReadableTemplateFile(upload.content, purpose))) throw new ApiException(422, TEMPLATE_FILE_MESSAGES[purpose].unreadable);
    return purpose === 'form' ? checkDocxTemplate(upload.content, sections) : checkXlsxTemplate(upload.content, sections);
  }

  /**
   * Thông tin điền mẫu của một lá đơn: người nộp đơn (MSSV chính), đơn lúc nộp, người xử lí.
   * @param form  lá đơn kèm người liên quan
   * @returns     thông tin để điền
   */
  private async exportSourceOf(form: FormWithPeople): Promise<ExportSource> {
    const { students, mainStudentId } = await this.studentDirectory.findStudentsResponse(form.ownerId, form.owner.mainStudentId);
    const snapshot = form.formTypeSnapshot as unknown as FormType;
    const decided = form.status === 'duyet' || form.status === 'tc';
    return {
      code: form.code,
      formTypeName: snapshot.name,
      submittedAt: toVietnamTime(form.submittedAt),
      status: form.status,
      receiverName: form.receiver?.name ?? null,
      handlerName: form.handler?.name ?? null,
      decidedAt: decided ? toVietnamTime(form.decidedAt ?? form.updatedAt) : null,
      note: form.note,
      applicant: { name: form.owner.name, email: form.owner.email, phone: form.owner.phone, cccd: form.owner.cccd },
      mainStudent: students.find((student) => student.studentId === mainStudentId) ?? null,
      sections: snapshot.sections,
      answers: form.answers as unknown as FormAnswers,
    };
  }

  /**
   * Điền dữ liệu của một lá đơn vào một mẫu xuất file đơn của loại đơn đó.
   * @param code        mã đơn
   * @param templateId  id mẫu
   * @param viewer      người đang đăng nhập
   * @returns           file Word đã điền
   * @throws            404 không có đơn / không được xem, mẫu không phải mẫu đơn của loại đơn này · 422 mẫu sai cú pháp
   */
  async exportForm(code: string, templateId: string, viewer: User): Promise<DownloadFile> {
    // Xem được đơn thì xuất được; không thì 404 (FORM_MESSAGES.notFound, cùng câu với EXPORT_MESSAGES.formNotFound)
    const form = await this.formService.loadViewable(code, viewer);

    // Mẫu phải là mẫu xuất file đơn của loại đơn này
    const template = await this.loadTemplate(form.formTypeId, templateId, 'form');

    // Điền mẫu; mẫu sai cú pháp thì báo lí do
    const exportedOn = toVietnamTime(new Date()).slice(0, 10);
    try {
      const filled = renderDocxTemplate(template.content, buildExportData(await this.exportSourceOf(form), exportedOn));
      return { fileName: exportFileName(form.code, template.name, 'form'), contentType: DOCX_CONTENT_TYPE, content: Buffer.from(filled) };
    } catch (docxError) {
      throw new ApiException(422, EXPORT_MESSAGES.renderFailed(explainDocxError(docxError)));
    }
  }

  /**
   * Điền mọi lá đơn của loại đơn (mọi phiên bản, mọi trạng thái, theo thứ tự nộp) vào một mẫu xuất file thống kê.
   * @param formTypeId  mã loại đơn (đã biết là có)
   * @param templateId  id mẫu
   * @returns           file Excel đã điền
   * @throws            404 mẫu không phải mẫu thống kê của loại đơn này · 422 không đọc được mẫu
   */
  async exportStats(formTypeId: string, templateId: string): Promise<DownloadFile> {
    const template = await this.loadTemplate(formTypeId, templateId, 'stats');

    // Mọi lá đơn của loại đơn, cũ trước; tên loại đơn theo phiên bản mới nhất, tiền tố mã đơn để đặt tên file
    const forms = await this.prisma.form.findMany({ where: { formTypeId }, include: WITH_PEOPLE, orderBy: [{ submittedAt: 'asc' }, { code: 'asc' }] });
    const formType = await this.prisma.formType.findUnique({
      where: { id: formTypeId },
      select: { prefix: true, versions: { orderBy: { version: 'desc' }, take: 1, select: { name: true } } },
    });

    // Dữ liệu từng đơn và mã chung của file
    const exportedOn = toVietnamTime(new Date()).slice(0, 10);
    const formsData = [];
    for (const form of forms) formsData.push(buildExportData(await this.exportSourceOf(form), exportedOn));
    const summaryData = {
      [FORM_COUNT_TAG]: forms.length,
      loai_don: formType?.versions[0]?.name ?? '',
      ngay_xuat: exportedOn.split('-').reverse().join('/'),
    };

    // Điền mẫu; không đọc được thì báo lí do
    try {
      const filled = await renderXlsxTemplate(template.content, formsData, summaryData);
      return {
        fileName: exportFileName(formType?.prefix ?? formTypeId, template.name, 'stats'),
        contentType: EXPORT_TEMPLATE_FILE.stats.contentType,
        content: Buffer.from(filled),
      };
    } catch (xlsxError) {
      throw new ApiException(422, EXPORT_MESSAGES.renderFailed(xlsxError instanceof Error ? xlsxError.message : String(xlsxError)));
    }
  }
}
