/* Quản lí loại đơn: danh sách, loại đơn đang mở, phiên bản (xem, tạo loại đơn, thêm phiên bản, lưu Nháp,
   mở / đóng, xóa Nháp), cấu hình thời gian (thời gian xử lí, giờ tự mở / đóng, chạy hẹn giờ), thống kê câu trả lời (thẻ Thống kê).
   Chỉ làm việc với database, việc kiểm tra quyền nằm ở controller. */
import { Injectable, Logger } from '@nestjs/common';
import {
  FORM_TYPE_DRAFT_MESSAGES,
  FORM_TYPE_MESSAGES,
  computeFormTypeAnswerStats,
  dueScheduleSteps,
  issueMessages,
  markScheduleStepDone,
  pendingCloseAt,
  scheduledStatusChangeOf,
  timeSettingsAfterSave,
  validateFormTypeDraft,
  validateFormTypeTimeSettings,
  type FormAnswers,
  type FormSection,
  type FormType,
  type FormTypeAnswerStats,
  type FormTypeStatsQuery,
  type FormTypeStatus,
  type FormTypeSummary,
  type FormTypeTimeSettings,
  type FormTypeVersion,
  type FormTypesResponse,
  type ManagedFormType,
  type OpenFormTypesResponse,
  type SaveFormTypeTimeSettingsRequest,
  type SaveFormTypeVersionRequest,
  type ScheduleStep,
} from '@ulaw/shared';
import { ApiException } from '../common/api-exception';
import { isUniqueViolation } from '../common/prisma-errors';
import { PrismaService } from '../common/prisma.service';
import { fromVietnamTime, toVietnamTime } from '../common/vietnam-time';
import type { FormType as FormTypeRow, FormTypeVersion as VersionRow, Prisma, User } from '../generated/prisma/client';

/** Một phiên bản đọc từ database, kèm cán bộ lưu. */
type VersionWithStaff = VersionRow & { updatedBy: User };
/** Một loại đơn đọc từ database, các phiên bản mới nhất trước. */
type FormTypeWithVersions = FormTypeRow & { versions: VersionWithStaff[] };

/** Cách đọc một loại đơn: mọi phiên bản (mới nhất trước) kèm cán bộ lưu. */
const WITH_VERSIONS = { versions: { orderBy: { version: 'desc' }, include: { updatedBy: true } } } as const satisfies Prisma.FormTypeInclude;

/** Một lần hẹn giờ đã chạy: loại đơn, việc, phiên bản đổi trạng thái (null = trạng thái đã đúng sẵn, hoặc không mở được). */
export interface ScheduleRun {
  formTypeId: string;
  kind: ScheduleStep['kind'];
  changedVersion: number | null;
}

/**
 * Đọc cấu hình thời gian từ các cột của loại đơn.
 * @param row  loại đơn trong database
 * @returns    theo FormTypeTimeSettingsSchema (giờ Việt Nam)
 */
function timeSettingsOf(row: FormTypeRow): FormTypeTimeSettings {
  return {
    maxProcessingDays: row.maxProcessingDays,
    autoOpen:
      row.autoOpenAt && row.autoOpenVersion !== null ? { at: toVietnamTime(row.autoOpenAt), version: row.autoOpenVersion, done: row.autoOpenDone } : null,
    autoClose: row.autoCloseAt ? { at: toVietnamTime(row.autoCloseAt), done: row.autoCloseDone } : null,
  };
}

/**
 * Đổi cấu hình thời gian thành các cột để ghi vào loại đơn.
 * @param settings  cấu hình thời gian
 * @returns         dữ liệu cập nhật FormType
 */
function timeSettingsColumns(settings: FormTypeTimeSettings): Prisma.FormTypeUpdateInput {
  return {
    maxProcessingDays: settings.maxProcessingDays,
    autoOpenAt: settings.autoOpen ? fromVietnamTime(settings.autoOpen.at) : null,
    autoOpenVersion: settings.autoOpen?.version ?? null,
    autoOpenDone: settings.autoOpen?.done ?? false,
    autoCloseAt: settings.autoClose ? fromVietnamTime(settings.autoClose.at) : null,
    autoCloseDone: settings.autoClose?.done ?? false,
  };
}

@Injectable()
export class FormTypesService {
  private readonly logger = new Logger(FormTypesService.name);

  /** @param prisma  kết nối database */
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Đổi một phiên bản trong database sang dạng gửi cho trình soạn.
   * @param row  phiên bản kèm cán bộ lưu
   * @returns     theo FormTypeVersionSchema (giờ Việt Nam)
   */
  private toVersion(row: VersionWithStaff): FormTypeVersion {
    return {
      version: row.version,
      status: row.status,
      name: row.name,
      description: row.description,
      sections: row.sections as unknown as FormSection[],
      updatedAt: toVietnamTime(row.updatedAt),
      updatedBy: { id: row.updatedBy.id, name: row.updatedBy.name, email: row.updatedBy.email },
    };
  }

  /**
   * Đổi một loại đơn trong database sang dạng gửi cho trình soạn.
   * @param row  loại đơn kèm các phiên bản
   * @returns    theo ManagedFormTypeSchema
   */
  private async toManaged(row: FormTypeWithVersions): Promise<ManagedFormType> {
    const [first, ...rest] = row.versions.map((version) => this.toVersion(version));
    return {
      id: row.id,
      prefix: row.prefix,
      prefixLocked: row.versions.some((version) => version.status !== 'draft'),
      formCount: await this.prisma.form.count({ where: { formTypeId: row.id } }),
      versions: [first!, ...rest],
    };
  }

  /**
   * Đọc loại đơn kèm mọi phiên bản.
   * @param client      PrismaService hoặc client của transaction đang chạy
   * @param formTypeId  mã loại đơn
   * @returns           loại đơn
   * @throws            404 không có loại đơn
   */
  private async loadFormType(client: Prisma.TransactionClient | PrismaService, formTypeId: string): Promise<FormTypeWithVersions> {
    const row = await client.formType.findUnique({ where: { id: formTypeId }, include: WITH_VERSIONS });
    if (!row) throw new ApiException(404, FORM_TYPE_MESSAGES.notFound);
    return row;
  }

  /**
   * Tìm một phiên bản trong loại đơn.
   * @param formType  loại đơn kèm các phiên bản
   * @param version   số phiên bản
   * @returns         phiên bản
   * @throws          404 không có phiên bản này
   */
  private findVersion(formType: FormTypeWithVersions, version: number): VersionWithStaff {
    const found = formType.versions.find((candidate) => candidate.version === version);
    if (!found) throw new ApiException(404, FORM_TYPE_MESSAGES.versionNotFound);
    return found;
  }

  /**
   * Mã đơn đã khóa (có phiên bản từng được mở) thì không được đổi.
   * @param formType  loại đơn kèm các phiên bản
   * @param prefix    mã đơn gửi lên
   * @throws          409 đổi mã đơn khi đã khóa
   */
  private assertPrefixChangeAllowed(formType: FormTypeWithVersions, prefix: string): void {
    const isLocked = formType.versions.some((version) => version.status !== 'draft');
    if (prefix !== formType.prefix && isLocked) throw new ApiException(409, FORM_TYPE_MESSAGES.prefixLocked);
  }

  /**
   * Kiểm tra bản soạn gửi lên như trình soạn: mã đơn trùng loại đơn khác thì 409, lỗi khác thì 422 kèm các câu báo.
   * @param draftInput        bản soạn đã đúng dạng
   * @param exceptFormTypeId  loại đơn đang lưu (không tính khi xét trùng mã đơn); tạo mới thì null
   * @returns                 bản soạn (mô tả trống thành null)
   */
  private async checkDraft(draftInput: SaveFormTypeVersionRequest, exceptFormTypeId: string | null): Promise<SaveFormTypeVersionRequest> {
    const others = await this.prisma.formType.findMany({ where: { id: { not: exceptFormTypeId ?? undefined } }, select: { prefix: true } });
    const issues = validateFormTypeDraft(draftInput, others.map((other) => other.prefix));
    const prefixTaken = FORM_TYPE_DRAFT_MESSAGES.prefixTaken(draftInput.prefix);
    if (issues.some((issue) => issue.message === prefixTaken)) throw new ApiException(409, prefixTaken);
    if (issues.length) throw new ApiException(422, issueMessages(issues).join(' '));
    return { ...draftInput, description: draftInput.description || null };
  }

  /**
   * Đặt trạng thái cho một phiên bản; mở thì phiên bản đang mở khác tự chuyển sang Đã đóng.
   * @param transaction  client của transaction đang chạy
   * @param formTypeId   mã loại đơn
   * @param version      số phiên bản cần đặt
   * @param status       trạng thái mới
   */
  private async applyStatus(transaction: Prisma.TransactionClient, formTypeId: string, version: number, status: FormTypeStatus): Promise<void> {
    if (status === 'open') {
      await transaction.formTypeVersion.updateMany({ where: { formTypeId, status: 'open', version: { not: version } }, data: { status: 'closed' } });
    }
    await transaction.formTypeVersion.update({ where: { formTypeId_version: { formTypeId, version } }, data: { status } });
  }

  /**
   * Chạy một lệnh ghi; mã đơn bị người khác giành mất lúc đang lưu (P2002) thì báo 409.
   * @param prefix  mã đơn đang lưu
   * @param write   lệnh ghi
   * @returns       kết quả của lệnh ghi
   */
  private async writeOrPrefixTaken<Result>(prefix: string, write: () => Promise<Result>): Promise<Result> {
    try {
      return await write();
    } catch (error) {
      if (isUniqueViolation(error)) throw new ApiException(409, FORM_TYPE_DRAFT_MESSAGES.prefixTaken(prefix));
      throw error;
    }
  }

  /**
   * Mọi loại đơn cho bảng Quản lí loại đơn: mỗi loại một dòng theo phiên bản mới nhất, kèm các phiên bản cũ hơn.
   * @returns  theo FormTypesResponseSchema
   */
  async findSummaries(): Promise<FormTypesResponse> {
    const rows = await this.prisma.formType.findMany({ orderBy: { id: 'asc' }, include: WITH_VERSIONS });
    const formCountGroups = await this.prisma.form.groupBy({ by: ['formTypeId'], _count: { _all: true } });
    const formCounts = new Map(formCountGroups.map((group) => [group.formTypeId, group._count._all]));
    const formTypes = rows.map((row): FormTypeSummary => {
      const [latest, ...olderVersions] = row.versions.map((version) => this.toVersion(version));
      const { version, status, name, description, updatedAt, updatedBy } = latest!;
      return {
        id: row.id,
        prefix: row.prefix,
        name,
        description,
        version,
        status,
        updatedAt,
        updatedBy,
        formCount: formCounts.get(row.id) ?? 0,
        olderVersions: olderVersions.map(({ sections: _sections, description: _description, ...summary }) => summary),
      };
    });
    return { formTypes };
  }

  /**
   * Các loại đơn đang nhận đơn (có phiên bản Đang mở), theo tên của phiên bản đang mở, kèm giờ tự đóng chưa chạy.
   * @returns  theo OpenFormTypesResponseSchema, chưa có cấu trúc các phần
   */
  async findOpen(): Promise<OpenFormTypesResponse> {
    const rows = await this.prisma.formType.findMany({
      where: { versions: { some: { status: 'open' } } },
      orderBy: { id: 'asc' },
      include: { versions: { where: { status: 'open' } } },
    });
    return {
      formTypes: rows.map((row) => ({
        id: row.id,
        name: row.versions[0]!.name,
        prefix: row.prefix,
        description: row.versions[0]!.description,
        acceptsUntil: pendingCloseAt(timeSettingsOf(row)),
      })),
    };
  }

  /**
   * Phiên bản đang mở của một loại đơn, đủ cấu trúc các phần, câu hỏi (để nộp đơn).
   * @param formTypeId  mã loại đơn, vd 'xmr'
   * @returns           theo FormTypeSchema
   * @throws            404 không có loại đơn, hoặc không có phiên bản nào đang mở
   */
  async findOpenDetail(formTypeId: string): Promise<FormType> {
    const row = await this.prisma.formType.findUnique({ where: { id: formTypeId }, include: { versions: { where: { status: 'open' } } } });
    const opened = row?.versions[0];
    if (!row || !opened) throw new ApiException(404, FORM_TYPE_MESSAGES[404]);
    return {
      id: row.id,
      prefix: row.prefix,
      name: opened.name,
      description: opened.description,
      version: opened.version,
      status: opened.status,
      maxProcessingDays: row.maxProcessingDays,
      sections: opened.sections as unknown as FormSection[],
    };
  }

  /**
   * Loại đơn kèm mọi phiên bản, cho trình soạn.
   * @param formTypeId  mã loại đơn
   * @returns           theo ManagedFormTypeSchema
   * @throws            404 không có loại đơn
   */
  async findManaged(formTypeId: string): Promise<ManagedFormType> {
    return this.toManaged(await this.loadFormType(this.prisma, formTypeId));
  }

  /**
   * Tạo loại đơn với phiên bản 1. Mã loại đơn lấy theo mã đơn viết thường (trùng thì thêm số).
   * @param draftInput  bản soạn gửi lên
   * @param staffId     cán bộ tạo
   * @returns           loại đơn vừa tạo
   * @throws            409 mã đơn đã có · 422 bản soạn chưa hợp lệ
   */
  async create(draftInput: SaveFormTypeVersionRequest, staffId: string): Promise<ManagedFormType> {
    const draft = await this.checkDraft(draftInput, null);
    const baseId = draft.prefix.toLowerCase();
    let formTypeId = baseId;
    for (let n = 2; await this.prisma.formType.findUnique({ where: { id: formTypeId } }); n += 1) formTypeId = `${baseId}-${n}`;

    await this.writeOrPrefixTaken(draft.prefix, () =>
      this.prisma.formType.create({
        data: {
          id: formTypeId,
          prefix: draft.prefix,
          versions: {
            create: {
              version: 1,
              status: draft.status,
              name: draft.name,
              description: draft.description,
              sections: draft.sections as unknown as Prisma.InputJsonValue,
              updatedAt: new Date(),
              updatedById: staffId,
            },
          },
        },
      }),
    );
    return this.findManaged(formTypeId);
  }

  /**
   * Thêm phiên bản mới (Nháp hoặc mở luôn). Không được khi đang có phiên bản Nháp. Mã đơn đã khóa thì không đổi.
   * @param formTypeId  mã loại đơn
   * @param draftInput  bản soạn gửi lên
   * @param staffId     cán bộ lưu
   * @returns           loại đơn sau khi thêm
   * @throws            404 không có loại đơn · 409 đang có Nháp, mã đơn khóa hoặc trùng · 422 bản soạn chưa hợp lệ
   */
  async addVersion(formTypeId: string, draftInput: SaveFormTypeVersionRequest, staffId: string): Promise<ManagedFormType> {
    const draft = await this.checkDraft(draftInput, formTypeId);
    await this.writeOrPrefixTaken(draft.prefix, () =>
      this.prisma.$transaction(async (transaction) => {
        const formType = await this.loadFormType(transaction, formTypeId);
        const existingDraft = formType.versions.find((version) => version.status === 'draft');
        if (existingDraft) throw new ApiException(409, FORM_TYPE_MESSAGES.draftExists(existingDraft.version));
        this.assertPrefixChangeAllowed(formType, draft.prefix);

        const version = formType.versions[0]!.version + 1;
        await transaction.formType.update({ where: { id: formTypeId }, data: { prefix: draft.prefix } });
        await transaction.formTypeVersion.create({
          data: {
            formTypeId,
            version,
            status: 'draft',
            name: draft.name,
            description: draft.description,
            sections: draft.sections as unknown as Prisma.InputJsonValue,
            updatedAt: new Date(),
            updatedById: staffId,
          },
        });
        await this.applyStatus(transaction, formTypeId, version, draft.status);
      }),
    );
    return this.findManaged(formTypeId);
  }

  /**
   * Lưu phiên bản Nháp (nội dung, và mở luôn nếu chọn Đang mở). Phiên bản đã khóa thì không sửa được.
   * @param formTypeId  mã loại đơn
   * @param version     số phiên bản
   * @param draftInput  bản soạn gửi lên
   * @param staffId     cán bộ lưu
   * @returns           loại đơn sau khi lưu
   * @throws            404 không có loại đơn hoặc phiên bản · 409 phiên bản đã khóa, mã đơn khóa hoặc trùng · 422 bản soạn chưa hợp lệ
   */
  async saveVersion(formTypeId: string, version: number, draftInput: SaveFormTypeVersionRequest, staffId: string): Promise<ManagedFormType> {
    const draft = await this.checkDraft(draftInput, formTypeId);
    await this.writeOrPrefixTaken(draft.prefix, () =>
      this.prisma.$transaction(async (transaction) => {
        const formType = await this.loadFormType(transaction, formTypeId);
        const target = this.findVersion(formType, version);
        if (target.status !== 'draft') throw new ApiException(409, FORM_TYPE_MESSAGES.versionLocked);
        this.assertPrefixChangeAllowed(formType, draft.prefix);

        await transaction.formType.update({ where: { id: formTypeId }, data: { prefix: draft.prefix } });
        await transaction.formTypeVersion.update({
          where: { formTypeId_version: { formTypeId, version } },
          data: {
            name: draft.name,
            description: draft.description,
            sections: draft.sections as unknown as Prisma.InputJsonValue,
            updatedAt: new Date(),
            updatedById: staffId,
          },
        });
        await this.applyStatus(transaction, formTypeId, version, draft.status);
      }),
    );
    return this.findManaged(formTypeId);
  }

  /**
   * Mở / đóng phiên bản đã khóa (lưu lại lúc đổi và người đổi).
   * @param formTypeId  mã loại đơn
   * @param version     số phiên bản
   * @param status      Đang mở hoặc Đã đóng
   * @param staffId     cán bộ đổi
   * @returns           loại đơn sau khi đổi
   * @throws            404 không có loại đơn hoặc phiên bản · 409 phiên bản còn là Nháp
   */
  async setVersionStatus(formTypeId: string, version: number, status: 'open' | 'closed', staffId: string): Promise<ManagedFormType> {
    await this.prisma.$transaction(async (transaction) => {
      const formType = await this.loadFormType(transaction, formTypeId);
      if (this.findVersion(formType, version).status === 'draft') throw new ApiException(409, FORM_TYPE_MESSAGES.draftNotLocked);

      await this.applyStatus(transaction, formTypeId, version, status);
      await transaction.formTypeVersion.update({
        where: { formTypeId_version: { formTypeId, version } },
        data: { updatedAt: new Date(), updatedById: staffId },
      });
    });
    return this.findManaged(formTypeId);
  }

  /**
   * Xóa phiên bản Nháp; nếu đó là phiên bản duy nhất thì xóa luôn loại đơn.
   * @param formTypeId  mã loại đơn
   * @param version     số phiên bản
   * @returns           loại đơn sau khi xóa; xóa luôn loại đơn thì null
   * @throws            404 không có loại đơn hoặc phiên bản · 409 phiên bản đã khóa
   */
  async deleteVersion(formTypeId: string, version: number): Promise<ManagedFormType | null> {
    const deletedWholeFormType = await this.prisma.$transaction(async (transaction) => {
      const formType = await this.loadFormType(transaction, formTypeId);
      if (this.findVersion(formType, version).status !== 'draft') throw new ApiException(409, FORM_TYPE_MESSAGES.onlyDraftDeletable);

      if (formType.versions.length === 1) {
        await transaction.formType.delete({ where: { id: formTypeId } });
        return true;
      }
      await transaction.formTypeVersion.delete({ where: { formTypeId_version: { formTypeId, version } } });
      return false;
    });
    return deletedWholeFormType ? null : this.findManaged(formTypeId);
  }

  /**
   * Cấu hình thời gian của loại đơn (khung Cấu hình thời gian ở trình soạn).
   * @param formTypeId  mã loại đơn
   * @returns           theo FormTypeTimeSettingsSchema
   * @throws            404 không có loại đơn
   */
  async findTimeSettings(formTypeId: string): Promise<FormTypeTimeSettings> {
    const row = await this.prisma.formType.findUnique({ where: { id: formTypeId } });
    if (!row) throw new ApiException(404, FORM_TYPE_MESSAGES.notFound);
    return timeSettingsOf(row);
  }

  /**
   * Lưu cấu hình thời gian; không tạo phiên bản mới. Giờ không đổi thì giữ dấu đã chạy, sửa giờ thì bỏ dấu.
   * @param formTypeId  mã loại đơn
   * @param request     cấu hình gửi lên (đã đúng dạng)
   * @returns           cấu hình sau khi lưu
   * @throws            404 không có loại đơn · 422 sai luật (câu báo như khung Cấu hình thời gian)
   */
  async saveTimeSettings(formTypeId: string, request: SaveFormTypeTimeSettingsRequest): Promise<FormTypeTimeSettings> {
    return this.prisma.$transaction(async (transaction) => {
      const formType = await this.loadFormType(transaction, formTypeId);
      const previous = timeSettingsOf(formType);
      const versions = formType.versions.map((version) => version.version);
      const issues = validateFormTypeTimeSettings(request, versions, previous, toVietnamTime(new Date()));
      if (issues.length) throw new ApiException(422, issueMessages(issues).join(' '));

      const saved = timeSettingsAfterSave(previous, request);
      await transaction.formType.update({ where: { id: formTypeId }, data: timeSettingsColumns(saved) });
      return saved;
    });
  }

  /**
   * Chạy các giờ tự mở / tự đóng đã tới mà chưa chạy (bộ hẹn giờ gọi mỗi phút), rồi đánh dấu đã chạy.
   * Đổi trạng thái như cán bộ bấm tay (mở thì phiên bản đang mở khác tự đóng); trạng thái đã đúng sẵn thì không đổi gì.
   * Không ghi lần lưu của phiên bản (người lưu gần nhất giữ nguyên), dấu "✓ đã mở" / "✓ đã đóng" cho biết hệ thống đã chạy.
   * Bản Nháp chưa hợp lệ để mở (vd chưa có câu hỏi) thì không mở, vẫn đánh dấu đã chạy để không thử lại mỗi phút, ghi log.
   * @param now  lúc kiểm
   * @returns    các việc đã chạy
   */
  async runDueSchedules(now: Date = new Date()): Promise<ScheduleRun[]> {
    const dueFormTypes = await this.prisma.formType.findMany({
      where: { OR: [{ autoOpenDone: false, autoOpenAt: { lte: now } }, { autoCloseDone: false, autoCloseAt: { lte: now } }] },
      select: { id: true },
      orderBy: { id: 'asc' },
    });

    const runs: ScheduleRun[] = [];
    for (const { id } of dueFormTypes) {
      runs.push(...(await this.prisma.$transaction((transaction) => this.runFormTypeSchedule(transaction, id, toVietnamTime(now)))));
    }
    if (runs.length) this.logger.log(`Hẹn giờ mở / đóng loại đơn: ${runs.map((run) => `${run.formTypeId} ${run.kind}`).join(', ')}`);
    return runs;
  }

  /**
   * Chạy các việc hẹn giờ đã tới của một loại đơn, trong một transaction.
   * @param transaction  client của transaction đang chạy
   * @param formTypeId   mã loại đơn
   * @param nowText      lúc kiểm, giờ Việt Nam 'YYYY-MM-DDTHH:mm'
   * @returns            các việc đã chạy
   */
  private async runFormTypeSchedule(transaction: Prisma.TransactionClient, formTypeId: string, nowText: string): Promise<ScheduleRun[]> {
    let formType = await this.loadFormType(transaction, formTypeId);
    let settings = timeSettingsOf(formType);
    const runs: ScheduleRun[] = [];

    // Từng việc theo thứ tự giờ; đọc lại phiên bản sau mỗi lần đổi (vd vừa mở xong thì việc đóng đóng đúng phiên bản đó)
    for (const step of dueScheduleSteps(settings, nowText)) {
      const change = scheduledStatusChangeOf(step, formType.versions);
      const canApply = change !== null && (await this.canOpenBySchedule(transaction, formType, change.version, change.status));
      if (change && canApply) {
        await this.applyStatus(transaction, formTypeId, change.version, change.status);
        formType = await this.loadFormType(transaction, formTypeId);
      }
      settings = markScheduleStepDone(settings, step.kind);
      runs.push({ formTypeId, kind: step.kind, changedVersion: change && canApply ? change.version : null });
    }

    await transaction.formType.update({ where: { id: formTypeId }, data: timeSettingsColumns(settings) });
    return runs;
  }

  /**
   * Hẹn giờ có được đổi phiên bản này sang trạng thái này không: mở bản Nháp thì bản Nháp phải hợp lệ như khi bấm Lưu với Đang mở.
   * @param transaction  client của transaction đang chạy
   * @param formType     loại đơn kèm các phiên bản
   * @param version      số phiên bản
   * @param status       trạng thái mới
   * @returns            true nếu được; bản Nháp chưa hợp lệ thì false (đã ghi log)
   */
  private async canOpenBySchedule(
    transaction: Prisma.TransactionClient,
    formType: FormTypeWithVersions,
    version: number,
    status: 'open' | 'closed',
  ): Promise<boolean> {
    const target = this.findVersion(formType, version);
    if (status !== 'open' || target.status !== 'draft') return true;

    const others = await transaction.formType.findMany({ where: { id: { not: formType.id } }, select: { prefix: true } });
    const draft = { name: target.name, prefix: formType.prefix, status: 'open' as const, sections: target.sections as unknown as FormSection[] };
    const issues = validateFormTypeDraft(draft, others.map((other) => other.prefix));
    if (!issues.length) return true;
    this.logger.warn(`Không tự mở được phiên bản ${version} của ${formType.id}: ${issueMessages(issues).join(' ')}`);
    return false;
  }

  /**
   * Thống kê câu trả lời các đơn của một loại đơn (thẻ Thống kê ở trình soạn). Luật đếm, chia nhóm ở computeFormTypeAnswerStats.
   * @param formTypeId  mã loại đơn
   * @param query       điều kiện: phiên bản, khoảng ngày nộp, trạng thái
   * @returns           số đơn, số đơn theo trạng thái, thống kê từng câu hỏi
   * @throws            404 không có loại đơn, hoặc phiên bản chọn không có (bản nháp không tính)
   */
  async findAnswerStats(formTypeId: string, query: FormTypeStatsQuery): Promise<FormTypeAnswerStats> {
    // Loại đơn và các phiên bản đã từng mở (bản nháp chưa có đơn nào)
    const formType = await this.prisma.formType.findUnique({
      where: { id: formTypeId },
      select: { versions: { where: { status: { not: 'draft' } }, select: { version: true, sections: true } } },
    });
    if (!formType) throw new ApiException(404, FORM_TYPE_MESSAGES.notFound);

    // Mọi lá đơn của loại đơn: chỉ đọc phần cần để thống kê
    const forms = await this.prisma.form.findMany({
      where: { formTypeId },
      select: { code: true, formTypeVersion: true, status: true, submittedAt: true, answers: true },
    });
    const stats = computeFormTypeAnswerStats(
      formType.versions.map(({ version, sections }) => ({ version, sections: sections as unknown as FormSection[] })),
      forms.map((form) => ({
        code: form.code,
        version: form.formTypeVersion,
        status: form.status,
        submittedAt: toVietnamTime(form.submittedAt),
        answers: form.answers as unknown as FormAnswers,
      })),
      query,
    );
    if (!stats) throw new ApiException(404, FORM_TYPE_MESSAGES.versionNotFound);
    return stats;
  }
}
