/* Quản lí loại đơn: danh sách, loại đơn đang mở, phiên bản (xem, tạo loại đơn, thêm phiên bản, lưu Nháp,
   mở / đóng, xóa Nháp). Chỉ làm việc với database, việc kiểm tra quyền nằm ở controller. */
import { Injectable } from '@nestjs/common';
import {
  FORM_TYPE_DRAFT_MESSAGES,
  FORM_TYPE_MESSAGES,
  issueMessages,
  validateFormTypeDraft,
  type FormSection,
  type FormType,
  type FormTypeStatus,
  type FormTypeSummary,
  type FormTypeVersion,
  type FormTypesResponse,
  type ManagedFormType,
  type OpenFormTypesResponse,
  type SaveFormTypeVersionRequest,
} from '@ulaw/shared';
import { ApiException } from '../common/api-exception';
import { isUniqueViolation } from '../common/prisma-errors';
import { PrismaService } from '../common/prisma.service';
import { toVietnamTime } from '../common/vietnam-time';
import type { FormType as FormTypeRow, FormTypeVersion as VersionRow, Prisma, User } from '../generated/prisma/client';

/** Một phiên bản đọc từ database, kèm cán bộ lưu. */
type VersionWithStaff = VersionRow & { updatedBy: User };
/** Một loại đơn đọc từ database, các phiên bản mới nhất trước. */
type FormTypeWithVersions = FormTypeRow & { versions: VersionWithStaff[] };

/** Cách đọc một loại đơn: mọi phiên bản (mới nhất trước) kèm cán bộ lưu. */
const WITH_VERSIONS = { versions: { orderBy: { version: 'desc' }, include: { updatedBy: true } } } as const satisfies Prisma.FormTypeInclude;

@Injectable()
export class FormTypesService {
  /** @param prisma  kết nối database */
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Đổi một phiên bản trong database sang dạng gửi cho trình soạn.
   * @param row  phiên bản kèm cán bộ lưu
   * @returns    theo FormTypeVersionSchema (giờ Việt Nam)
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
   * Các loại đơn đang nhận đơn (có phiên bản Đang mở), theo tên của phiên bản đang mở.
   * @returns  theo OpenFormTypesResponseSchema, chưa có cấu trúc các phần
   */
  async findOpen(): Promise<OpenFormTypesResponse> {
    const rows = await this.prisma.formType.findMany({
      where: { versions: { some: { status: 'open' } } },
      orderBy: { id: 'asc' },
      include: { versions: { where: { status: 'open' } } },
    });
    return { formTypes: rows.map((row) => ({ id: row.id, name: row.versions[0]!.name, prefix: row.prefix, description: row.versions[0]!.description })) };
  }

  /**
   * Phiên bản đang mở của một loại đơn, đủ cấu trúc các phần, câu hỏi (để nộp đơn).
   * @param formTypeId  mã loại đơn, vd 'xmm'
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
}
