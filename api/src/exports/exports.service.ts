/* Mẫu xuất file Word của loại đơn (danh sách, lưu các thay đổi, mẫu gốc, kiểm tra mã) và xuất file một lá đơn.
   Đọc, kiểm tra, điền mẫu bằng các hàm của shared/ (exports--docx.ts), giống hệt API giả. */
import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import {
  EXPORT_MESSAGES,
  buildExportData,
  checkDocxTemplate,
  explainDocxError,
  openDocx,
  renderDocxTemplate,
  textToTag,
  type ExportSource,
  type ExportTemplate,
  type ExportTemplateCheck,
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
import type { ExportTemplate as ExportTemplateRow, User } from '../generated/prisma/client';
import { StudentDirectoryService } from '../student-directory/student-directory.service';

/** Một file nhận được trong body multipart. */
export interface UploadedDocx {
  /** Tên file người dùng đặt (đã đọc đúng chữ có dấu) */
  fileName: string;
  content: Buffer;
}

/** Một file Word trả về cho trình duyệt. */
export interface DocxFile {
  fileName: string;
  content: Buffer;
}

/** Mẫu kèm họ tên người tải lên, đủ để dựng ExportTemplate. */
type TemplateWithUploader = ExportTemplateRow & { uploadedBy: { name: string } };

/**
 * Kiểm tra một file mẫu tải lên: đuôi .docx và đọc được.
 * @param upload  file nhận được
 * @returns       câu báo lỗi; hợp lệ thì null
 */
function docxProblemOf(upload: UploadedDocx): string | null {
  if (!/\.docx$/i.test(upload.fileName)) return EXPORT_MESSAGES.notDocx;
  if (!openDocx(upload.content)) return `${upload.fileName}: ${EXPORT_MESSAGES.unreadable}`;
  return null;
}

/**
 * Tên file xuất ra, không dấu (một số trình duyệt đổi tên file có dấu thành "download").
 * @param prefix        phần đầu, vd mã đơn
 * @param templateName  tên mẫu
 * @returns             vd 'XMM-2026-001-00001_don-gui-phong-dao-tao.docx'
 */
function exportFileName(prefix: string, templateName: string): string {
  return `${prefix}_${textToTag(templateName).replace(/_/g, '-')}.docx`;
}

/**
 * Dựng ExportTemplate từ dòng trong database.
 * @param row  mẫu kèm người tải lên
 * @returns    theo ExportTemplateSchema
 */
function toTemplate(row: TemplateWithUploader): ExportTemplate {
  return {
    id: row.id,
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
   * Các mẫu của loại đơn, theo thứ tự tải lên.
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
   * @throws            404 mẫu cần xóa / đổi tên không còn · 422 thiếu file, không phải .docx, không đọc được
   */
  async saveTemplates(
    formTypeId: string,
    changes: SaveExportTemplatesRequest,
    uploads: ReadonlyMap<string, UploadedDocx>,
    staff: User,
  ): Promise<ExportTemplatesResponse> {
    // Mẫu cần xóa / đổi tên phải còn
    const savedRows = await this.prisma.exportTemplate.findMany({ where: { formTypeId }, select: { id: true } });
    const savedIds = new Set(savedRows.map((row) => row.id));
    const touchedIds = [...changes.removed, ...changes.renamed.map((rename) => rename.templateId)];
    if (touchedIds.some((templateId) => !savedIds.has(templateId))) throw new ApiException(404, EXPORT_MESSAGES.templateNotFound);

    // Mỗi mẫu mới phải có file .docx đọc được
    const newTemplates = changes.added.map((added) => {
      const upload = uploads.get(added.tempId);
      if (!upload) throw new ApiException(422, EXPORT_MESSAGES.fileMissing(added.name));
      const problem = docxProblemOf(upload);
      if (problem) throw new ApiException(422, problem);
      return { name: added.name.trim(), upload };
    });

    // Lưu theo thứ tự: xóa, đổi tên, thêm (cùng một transaction); cùng giờ tải lên thì theo thứ tự gửi
    const uploadedAt = new Date();
    await this.prisma.$transaction([
      this.prisma.exportTemplate.deleteMany({ where: { formTypeId, id: { in: changes.removed } } }),
      ...changes.renamed.map(({ templateId, name }) => this.prisma.exportTemplate.update({ where: { id: templateId }, data: { name: name.trim() } })),
      ...newTemplates.map(({ name, upload }, index) =>
        this.prisma.exportTemplate.create({
          data: {
            id: `tpl-${randomUUID()}`,
            formTypeId,
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
   * @returns           mẫu kèm nội dung
   * @throws            404 mẫu không có, hoặc không thuộc loại đơn này
   */
  private async loadTemplate(formTypeId: string, templateId: string): Promise<ExportTemplateRow> {
    const row = await this.prisma.exportTemplate.findFirst({ where: { id: templateId, formTypeId } });
    if (!row) throw new ApiException(404, EXPORT_MESSAGES.templateNotFound);
    return row;
  }

  /**
   * Mẫu gốc còn nguyên các mã (nút Xem mẫu).
   * @param formTypeId  mã loại đơn
   * @param templateId  id mẫu
   * @returns           tên file lúc tải lên và nội dung
   * @throws            404 mẫu không có
   */
  async findTemplateFile(formTypeId: string, templateId: string): Promise<DocxFile> {
    const row = await this.loadTemplate(formTypeId, templateId);
    return { fileName: row.fileName, content: Buffer.from(row.content) };
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
    return checkDocxTemplate(row.content, sections);
  }

  /**
   * Kiểm tra mã trong một file mẫu chưa lưu (không lưu lại).
   * @param upload    file gửi kèm
   * @param sections  các phần của bản soạn
   * @returns         kết quả kiểm tra
   * @throws          422 không phải .docx, hoặc không đọc được
   */
  checkUploadedTemplate(upload: UploadedDocx, sections: readonly FormSection[]): ExportTemplateCheck {
    if (!/\.docx$/i.test(upload.fileName)) throw new ApiException(422, EXPORT_MESSAGES.notDocx);
    if (!openDocx(upload.content)) throw new ApiException(422, EXPORT_MESSAGES.unreadable);
    return checkDocxTemplate(upload.content, sections);
  }

  /**
   * Điền dữ liệu của một lá đơn vào một mẫu của loại đơn đó.
   * @param code        mã đơn
   * @param templateId  id mẫu
   * @param viewer      người đang đăng nhập
   * @returns           file Word đã điền
   * @throws            404 không có đơn / không được xem, mẫu không thuộc loại đơn của đơn · 422 mẫu sai cú pháp
   */
  async exportForm(code: string, templateId: string, viewer: User): Promise<DocxFile> {
    // Xem được đơn thì xuất được; không thì 404 (FORM_MESSAGES.notFound, cùng câu với EXPORT_MESSAGES.formNotFound)
    const form = await this.formService.loadViewable(code, viewer);

    // Mẫu phải thuộc loại đơn của đơn này
    const template = await this.loadTemplate(form.formTypeId, templateId);

    // Thông tin điền mẫu: người nộp đơn (MSSV chính), đơn lúc nộp, người xử lí
    const { students, mainStudentId } = await this.studentDirectory.findStudentsResponse(form.ownerId, form.owner.mainStudentId);
    const snapshot = form.formTypeSnapshot as unknown as FormType;
    const decided = form.status === 'duyet' || form.status === 'tc';
    const exportSource: ExportSource = {
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

    // Điền mẫu; mẫu sai cú pháp thì báo lí do
    const exportedOn = toVietnamTime(new Date()).slice(0, 10);
    try {
      const filled = renderDocxTemplate(template.content, buildExportData(exportSource, exportedOn));
      return { fileName: exportFileName(form.code, template.name), content: Buffer.from(filled) };
    } catch (docxError) {
      throw new ApiException(422, EXPORT_MESSAGES.renderFailed(explainDocxError(docxError)));
    }
  }
}
