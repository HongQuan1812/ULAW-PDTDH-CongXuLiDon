/* Một lá đơn: chi tiết, nộp mới, sửa. Kiểm tra quyền, kiểm tra câu trả lời, ghi database và ổ đĩa (đơn và tệp lưu cùng lúc). */
import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import {
  ANSWER_MESSAGES,
  FORM_MESSAGES,
  can,
  canEditForm,
  formatFormCode,
  isEditable,
  validateAnswers,
  validateSentFiles,
  type FileRef,
  type FormAnswers,
  type FormDetail,
  type FormSection,
  type FormSummary,
  type FormType,
  type SentFileInfo,
  type SubmitFormRequest,
  type UpdateFormRequest,
} from '@ulaw/shared';
import { ApiException } from '../common/api-exception';
import { PrismaService } from '../common/prisma.service';
import { toVietnamTime } from '../common/vietnam-time';
import { FileStorageService } from '../files/file-storage.service';
import { FormTypesService } from '../form-types/form-types.service';
import type { Prisma, Form, User } from '../generated/prisma/client';
import { fileRefsIn, mergeAnswers } from './form-answers';

/** Một tệp nhận được trong body multipart. */
export interface UploadedPart {
  /** Tên tệp người dùng đặt (đã đọc đúng chữ có dấu) */
  name: string;
  content: Buffer;
}

/** Đơn kèm người nộp và hai cán bộ liên quan, đủ để dựng FormDetail. */
type FormWithPeople = Form & { owner: User; receiver: User | null; handler: User | null };
const WITH_PEOPLE = { owner: true, receiver: true, handler: true } as const;

/** Kết quả ghi các tệp mới lên ổ đĩa. */
interface StoredUploads {
  refs: Map<string, FileRef>;
  storagePaths: string[];
  rows: Prisma.FileObjectCreateWithoutFormInput[];
}

/** Cách đọc body multipart của request (controller đưa vào, để kiểm tra quyền trước khi đọc body). */
export type ReadSubmission<Body> = () => { body: Body; uploads: ReadonlyMap<string, UploadedPart> };

/** Năm theo giờ Việt Nam, để đánh số mã đơn. */
const yearOf = (moment: Date): number => Number(toVietnamTime(moment).slice(0, 4));

@Injectable()
export class FormService {
  /**
   * @param prisma      kết nối database
   * @param storage     lưu tệp trên ổ đĩa
   * @param formTypes   lấy cấu trúc loại đơn đang mở
   */
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: FileStorageService,
    private readonly formTypes: FormTypesService,
  ) {}

  /**
   * Dựng FormDetail từ đơn trong database.
   * @param form  đơn kèm người nộp, người tiếp nhận, người xử lí
   * @returns     theo FormDetailSchema
   */
  private toDetail(form: FormWithPeople): FormDetail {
    const snapshot = form.formTypeSnapshot as unknown as FormType;
    const toStaff = (staff: User | null) => (staff ? { id: staff.id, name: staff.name, email: staff.email } : null);
    return {
      code: form.code,
      formTypeId: form.formTypeId,
      formTypeName: snapshot.name,
      submittedAt: toVietnamTime(form.submittedAt),
      status: form.status,
      updatedAt: toVietnamTime(form.updatedAt),
      note: form.note,
      applicant: { id: form.owner.id, name: form.owner.name, email: form.owner.email },
      receiver: toStaff(form.receiver),
      receivedAt: form.receivedAt ? toVietnamTime(form.receivedAt) : null,
      handler: toStaff(form.handler),
      handlerSince: form.handlerSince ? toVietnamTime(form.handlerSince) : null,
      sections: snapshot.sections,
      answers: form.answers as unknown as FormAnswers,
    };
  }

  /**
   * Lấy một lá đơn nếu người xem được phép: người nộp đơn, hoặc cán bộ có quyền viewAll.
   * @param code    mã đơn
   * @param viewer  người đang đăng nhập
   * @returns       đơn kèm người liên quan
   * @throws        404 không có đơn, hoặc không được xem (cùng một câu để không lộ mã đơn của người khác)
   */
  private async loadViewable(code: string, viewer: User): Promise<FormWithPeople> {
    const form = await this.prisma.form.findUnique({ where: { code }, include: WITH_PEOPLE });
    if (!form || (form.ownerId !== viewer.id && !can(viewer.role, 'viewAll'))) throw new ApiException(404, FORM_MESSAGES.notFound);
    return form;
  }

  /**
   * Chi tiết một lá đơn.
   * @param code    mã đơn
   * @param viewer  người đang đăng nhập
   * @returns       theo FormDetailSchema
   * @throws        404 không có đơn, hoặc không được xem
   */
  async findDetail(code: string, viewer: User): Promise<FormDetail> {
    return this.toDetail(await this.loadViewable(code, viewer));
  }

  /**
   * Kiểm tra câu trả lời, ô cam đoan và các tệp gửi kèm theo cấu trúc loại đơn.
   * @param sections      các phần của loại đơn
   * @param answers       câu trả lời; tệp mới mang id tạm
   * @param committed     đã đánh dấu ô cam đoan chưa
   * @param uploads       tệp gửi kèm theo id tạm
   * @param savedFileIds  id các tệp đơn đang có (sửa đơn); nộp mới thì rỗng
   * @throws              422 câu trả lời sai, chưa cam đoan, hoặc tệp thiếu / sai / thừa
   */
  private assertAnswersValid(
    sections: readonly FormSection[],
    answers: FormAnswers,
    committed: boolean,
    uploads: ReadonlyMap<string, UploadedPart>,
    savedFileIds: ReadonlySet<string>,
  ): void {
    const { invalidSectionTitles } = validateAnswers(sections, answers);
    if (invalidSectionTitles.length) throw new ApiException(422, ANSWER_MESSAGES.sectionsToCheck(invalidSectionTitles));
    if (!committed) throw new ApiException(422, ANSWER_MESSAGES.commitmentRequired);
    const sentFiles = new Map<string, SentFileInfo>([...uploads].map(([tempId, part]) => [tempId, { name: part.name, sizeBytes: part.content.byteLength }]));
    const fileError = validateSentFiles(sections, answers, sentFiles, savedFileIds);
    if (fileError) throw new ApiException(422, fileError);
  }

  /**
   * Ghi các tệp mới lên ổ đĩa, đặt id mới cho từng tệp.
   * @param uploads  tệp gửi kèm theo id tạm
   * @returns        refs: FileRef (id, tên, dung lượng thật) theo id tạm · storagePaths: đường dẫn lưu của mọi tệp mới (để dọn khi lỗi) ·
   *                  rows: dữ liệu tạo FileObject (ghi database)
   */
  private async storeUploads(uploads: ReadonlyMap<string, UploadedPart>): Promise<StoredUploads> {
    const refs = new Map<string, FileRef>();
    const storagePaths: string[] = [];
    const rows: Prisma.FileObjectCreateWithoutFormInput[] = [];
    try {
      for (const [tempId, part] of uploads) {
        const storagePath = await this.storage.save(part.content, part.name);
        storagePaths.push(storagePath);
        const ref = { id: `file-${randomUUID()}`, name: part.name, sizeBytes: part.content.byteLength };
        refs.set(tempId, ref);
        rows.push({ ...ref, storagePath, uploadedAt: new Date() });
      }
    } catch (error) {
      await this.removeStored(storagePaths);
      throw error;
    }
    return { refs, storagePaths, rows };
  }

  /**
   * Xóa các tệp trên ổ đĩa, bỏ qua tệp không xóa được (dọn dẹp không được làm hỏng kết quả chính).
   * @param storagePaths  đường dẫn lưu của các tệp
   */
  private async removeStored(storagePaths: readonly string[]): Promise<void> {
    await Promise.all(storagePaths.map((storagePath) => this.storage.remove(storagePath).catch(() => undefined)));
  }

  /**
   * Nộp đơn mới: kiểm tra hết, rồi sinh mã đơn, lưu đơn, bản chụp cấu trúc loại đơn, tệp và lịch sử trong một transaction.
   * Sai một chỗ thì không lưu gì (kể cả tệp trên ổ đĩa).
   * @param submitter  người đang đăng nhập (cần quyền submit; nộp thay cần submitForApplicant)
   * @param readSubmission  đọc phần chữ và tệp của body (gọi sau khi kiểm tra quyền)
   * @returns          dòng tóm tắt của đơn mới
   * @throws           403 thiếu quyền · 404 không có người nộp / loại đơn không nhận đơn · 422 câu trả lời hoặc tệp sai
   */
  async submit(submitter: User, readSubmission: ReadSubmission<SubmitFormRequest>): Promise<FormSummary> {
    // Quyền: nộp đơn; rồi mới đọc body (sai thì 422); nộp thay thì người đó phải có
    if (!can(submitter.role, 'submit')) throw new ApiException(403, FORM_MESSAGES.submitForbidden);
    const { body: request, uploads } = readSubmission();
    const ownerId = request.applicantId ?? submitter.id;
    if (ownerId !== submitter.id) {
      if (!can(submitter.role, 'submitForApplicant')) throw new ApiException(403, FORM_MESSAGES.submitForApplicantForbidden);
      if (!(await this.prisma.user.findUnique({ where: { id: ownerId }, select: { id: true } }))) throw new ApiException(404, FORM_MESSAGES.applicantNotFound);
    }

    // Loại đơn phải đang mở; câu trả lời, ô cam đoan, tệp phải hợp lệ
    const formType = await this.formTypes.findOpenDetail(request.formTypeId).catch((error: unknown) => {
      throw error instanceof ApiException ? new ApiException(404, FORM_MESSAGES.formTypeClosed) : error;
    });
    this.assertAnswersValid(formType.sections, request.answers, request.committed, uploads, new Set());

    // Đúng hết: ghi tệp lên ổ đĩa, rồi lưu đơn (lỗi thì dọn tệp)
    const { refs, storagePaths, rows } = await this.storeUploads(uploads);
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const submittedAt = new Date();
        const code = await this.nextFormCode(transaction, formType.prefix, yearOf(submittedAt), formType.version);
        const form = await transaction.form.create({
          data: {
            code,
            ownerId,
            formTypeId: formType.id,
            formTypeVersion: formType.version,
            status: 'nop',
            submittedAt,
            updatedAt: submittedAt,
            answers: mergeAnswers(formType.sections, request.answers, {}, refs) as unknown as Prisma.InputJsonValue,
            formTypeSnapshot: formType as unknown as Prisma.InputJsonValue,
            files: { create: rows.map((row) => ({ ...row, uploadedAt: submittedAt })) },
            events: { create: { action: 'submit', fromStatus: null, toStatus: 'nop', actorId: submitter.id, at: submittedAt } },
          },
        });
        return { code, formTypeId: form.formTypeId, formTypeName: formType.name, submittedAt: toVietnamTime(submittedAt), status: form.status };
      });
    } catch (error) {
      await this.removeStored(storagePaths);
      throw error;
    }
  }

  /**
   * Sinh mã đơn kế tiếp: số thứ tự lớn nhất đang có của cùng tiền tố và năm (mọi phiên bản), cộng 1.
   * Khóa theo tiền tố và năm trong suốt transaction, để hai đơn nộp cùng lúc không trùng mã.
   * @param transaction  transaction đang chạy
   * @param prefix       tiền tố loại đơn, vd 'XMM'
   * @param year         năm nộp
   * @param version      phiên bản loại đơn
   * @returns            vd 'XMM-2026-001-00038'
   */
  private async nextFormCode(transaction: Prisma.TransactionClient, prefix: string, year: number, version: number): Promise<string> {
    await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`form-code:${prefix}-${year}`}))`;
    const { _max } = await transaction.formCodeCounter.aggregate({ where: { prefix, year }, _max: { last: true } });
    const sequence = (_max.last ?? 0) + 1;
    await transaction.formCodeCounter.upsert({
      where: { prefix_year_version: { prefix, year, version } },
      create: { prefix, year, version, last: sequence },
      update: { last: sequence },
    });
    return formatFormCode(prefix, year, version, sequence);
  }

  /**
   * Sửa nội dung đơn: kiểm tra hết, rồi lưu câu trả lời và tệp mới trong một transaction; tệp bị gỡ xóa hẳn sau khi đơn lưu xong.
   * Đơn Cần bổ sung sau khi lưu chuyển sang Đã bổ sung.
   * @param editor   người đang đăng nhập
   * @param code     mã đơn
   * @param readSubmission  đọc phần chữ và tệp mới của body (gọi sau khi kiểm tra quyền)
   * @returns        lá đơn sau khi lưu
   * @throws         404 không xem được đơn · 403 không có quyền sửa · 409 đơn đã khóa · 422 câu trả lời hoặc tệp sai
   */
  async update(editor: User, code: string, readSubmission: ReadSubmission<UpdateFormRequest>): Promise<FormDetail> {
    // Quyền: không xem được thì 404; xem được mà không sửa được thì 409 (đơn đã khóa) hoặc 403 (không có quyền)
    const form = await this.loadViewable(code, editor);
    if (!canEditForm(editor, { status: form.status, applicantId: form.ownerId })) {
      throw isEditable(form.status) ? new ApiException(403, FORM_MESSAGES.editForbidden) : new ApiException(409, FORM_MESSAGES.notEditable);
    }

    // Đọc body (sai thì 422), kiểm tra theo cấu trúc loại đơn lúc nộp
    const { body: request, uploads } = readSubmission();
    const sections = (form.formTypeSnapshot as unknown as FormType).sections;
    const oldAnswers = form.answers as unknown as FormAnswers;
    const oldFiles = fileRefsIn(sections, oldAnswers);
    this.assertAnswersValid(sections, request.answers, request.committed, uploads, new Set(oldFiles.map((file) => file.id)));

    // Ghi tệp mới, rồi lưu đơn; lỗi thì dọn tệp mới
    const { refs, storagePaths, rows } = await this.storeUploads(uploads);
    const newAnswers = mergeAnswers(sections, request.answers, oldAnswers, refs);
    const keptIds = new Set(fileRefsIn(sections, newAnswers).map((file) => file.id));
    const removedIds = oldFiles.map((file) => file.id).filter((id) => !keptIds.has(id));
    const nextStatus = form.status === 'bs' ? 'bsg' : form.status;
    const removedPaths: string[] = [];
    try {
      await this.prisma.$transaction(async (transaction) => {
        const updatedAt = new Date();
        const removedRows = await transaction.fileObject.findMany({ where: { id: { in: removedIds }, formCode: code } });
        removedPaths.push(...removedRows.flatMap((row) => (row.storagePath ? [row.storagePath] : [])));
        await transaction.fileObject.deleteMany({ where: { id: { in: removedRows.map((row) => row.id) } } });
        await transaction.form.update({
          where: { code },
          data: {
            answers: newAnswers as unknown as Prisma.InputJsonValue,
            status: nextStatus,
            updatedAt,
            files: { create: rows.map((row) => ({ ...row, uploadedAt: updatedAt })) },
            events: { create: { action: 'edit', fromStatus: form.status, toStatus: nextStatus, actorId: editor.id, at: updatedAt } },
          },
        });
      });
    } catch (error) {
      await this.removeStored(storagePaths);
      throw error;
    }

    // Đơn đã lưu xong: xóa hẳn nội dung các tệp bị gỡ trên ổ đĩa
    await this.removeStored(removedPaths);
    return this.findDetail(code, editor);
  }
}
