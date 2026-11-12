/* Chuyển trạng thái đơn: tiếp nhận, ra quyết định (bổ sung / duyệt / từ chối), chuyển giao.
   Mọi bước đổi trạng thái đi qua đây. Kiểm tra quyền rồi ghi bằng câu lệnh có điều kiện trạng thái,
   nên hai cán bộ bấm cùng lúc thì chỉ một người thành công, người kia nhận 409. */
import { Injectable } from '@nestjs/common';
import {
  FORM_MESSAGES,
  ROLE_IDS,
  can,
  canDecideOn,
  canTransferForm,
  isDecidable,
  isReceivable,
  isTransferable,
  type DecideFormRequest,
  type FormDetail,
  type FormStatus,
  type StaffRef,
  type TransferFormRequest,
  type TransferTargetsResponse,
} from '@ulaw/shared';
import { ApiException } from '../common/api-exception';
import { PrismaService } from '../common/prisma.service';
import type { User } from '../generated/prisma/client';
import { FormService } from './form.service';

/** Các trạng thái cho phép chuyển giao / tiếp nhận / ra quyết định, lấy từ luật dùng chung. */
const STATUSES_WHERE = (isAllowed: (status: FormStatus) => boolean): FormStatus[] =>
  (['nop', 'xet', 'bs', 'bsg', 'duyet', 'tc'] as const).filter(isAllowed);

@Injectable()
export class WorkflowService {
  /**
   * @param prisma       kết nối database
   * @param formService  đọc đơn, dựng FormDetail
   */
  constructor(
    private readonly prisma: PrismaService,
    private readonly formService: FormService,
  ) {}

  /**
   * Tiếp nhận đơn: Đã nộp / Đã bổ sung → Đang xét; người bấm thành người tiếp nhận và người xử lí; xóa lí do cũ.
   * @param actor  cán bộ đang đăng nhập
   * @param code   mã đơn
   * @returns      đơn sau khi tiếp nhận
   * @throws       404 không xem được đơn · 403 thiếu quyền receive · 409 đơn không còn chờ tiếp nhận
   */
  async receive(actor: User, code: string): Promise<FormDetail> {
    const form = await this.formService.loadViewable(code, actor);
    if (!can(actor.role, 'receive')) throw new ApiException(403, FORM_MESSAGES.receiveForbidden);
    if (!isReceivable(form.status)) throw new ApiException(409, FORM_MESSAGES.notReceivable);

    // Chỉ ghi khi đơn vẫn đang chờ tiếp nhận (người khác có thể vừa tiếp nhận)
    const receivedAt = new Date();
    const { count } = await this.prisma.form.updateMany({
      where: { code, status: { in: STATUSES_WHERE(isReceivable) } },
      data: { status: 'xet', note: '', receiverId: actor.id, receivedAt, handlerId: actor.id, handlerSince: receivedAt },
    });
    if (count === 0) throw new ApiException(409, FORM_MESSAGES.notReceivable);
    return this.formService.findDetail(code, actor);
  }

  /**
   * Ra quyết định về đơn Đang xét: Cần bổ sung / Đã duyệt / Từ chối.
   * Duyệt thì xóa lí do. Không đổi người xử lí và lần lưu gần nhất.
   * @param actor         cán bộ đang đăng nhập
   * @param code          mã đơn
   * @param readDecision  cách đọc body (đọc sau khi đã xem được đơn, để 404 đứng trước 422)
   * @returns             đơn sau khi ra quyết định
   * @throws              404 không xem được đơn · 422 body sai · 403 không có quyền, hoặc đơn người khác phụ trách ·
   *                      409 đơn không còn Đang xét
   */
  async decide(actor: User, code: string, readDecision: () => DecideFormRequest): Promise<FormDetail> {
    const form = await this.formService.loadViewable(code, actor);
    const { decision, note } = readDecision();
    if (!can(actor.role, 'decide')) throw new ApiException(403, FORM_MESSAGES.decideForbidden);
    if (!isDecidable(form.status)) throw new ApiException(409, FORM_MESSAGES.notDecidable);
    if (!canDecideOn({ email: actor.email, role: actor.role }, { status: form.status, handler: form.handler })) {
      throw new ApiException(403, FORM_MESSAGES.decideForbidden);
    }

    // Chỉ ghi khi đơn vẫn Đang xét và vẫn do người này phụ trách (bị chuyển giao giữa chừng thì không ghi đè)
    const { count } = await this.prisma.form.updateMany({
      where: { code, status: { in: STATUSES_WHERE(isDecidable) }, handlerId: form.handlerId },
      data: { status: decision, note: decision === 'duyet' ? '' : note, ...(decision === 'bs' ? {} : { decidedAt: new Date() }) },
    });
    if (count === 0) throw new ApiException(409, FORM_MESSAGES.notDecidable);
    return this.formService.findDetail(code, actor);
  }

  /**
   * Cán bộ có thể nhận đơn khi chuyển giao: có quyền decide, trừ người đang xử lí.
   * @param actor  cán bộ đang đăng nhập
   * @param code   mã đơn
   * @returns      danh sách cán bộ
   * @throws       404 không xem được đơn · 403 thiếu quyền transfer · 409 đơn không còn chuyển giao được
   */
  async findTransferTargets(actor: User, code: string): Promise<TransferTargetsResponse> {
    const form = await this.formService.loadViewable(code, actor);
    if (!can(actor.role, 'transfer')) throw new ApiException(403, FORM_MESSAGES.transferForbidden);
    if (!canTransferForm(actor.role, form)) throw new ApiException(409, FORM_MESSAGES.notTransferable);
    return { staff: await this.staffExcept(form.handlerId) };
  }

  /**
   * Chuyển giao đơn: người nhận thành người xử lí, "Phụ trách từ" tính lại; trạng thái, người tiếp nhận, lí do không đổi.
   * @param actor         cán bộ đang đăng nhập
   * @param code          mã đơn
   * @param readTransfer  cách đọc body
   * @returns             đơn sau khi chuyển giao
   * @throws              404 · 422 body sai, hoặc người nhận không hợp lệ · 403 thiếu quyền transfer · 409 đơn không còn chuyển giao được
   */
  async transfer(actor: User, code: string, readTransfer: () => TransferFormRequest): Promise<FormDetail> {
    const form = await this.formService.loadViewable(code, actor);
    const { toStaffId } = readTransfer();
    if (!can(actor.role, 'transfer')) throw new ApiException(403, FORM_MESSAGES.transferForbidden);
    if (!canTransferForm(actor.role, form)) throw new ApiException(409, FORM_MESSAGES.notTransferable);
    const targets = await this.staffExcept(form.handlerId);
    if (!targets.some((staff) => staff.id === toStaffId)) throw new ApiException(422, FORM_MESSAGES.invalidTransferTarget);

    // Chỉ ghi khi đơn vẫn chuyển giao được
    const { count } = await this.prisma.form.updateMany({
      where: { code, status: { in: STATUSES_WHERE(isTransferable) } },
      data: { handlerId: toStaffId, handlerSince: new Date() },
    });
    if (count === 0) throw new ApiException(409, FORM_MESSAGES.notTransferable);
    return this.formService.findDetail(code, actor);
  }

  /**
   * Mọi cán bộ có quyền decide, trừ một người.
   * @param excludedId  id người bị loại (người đang xử lí)
   * @returns           danh sách cán bộ, xếp theo tên
   */
  private async staffExcept(excludedId: string | null): Promise<StaffRef[]> {
    const roles = ROLE_IDS.filter((roleId) => can(roleId, 'decide'));
    const staff = await this.prisma.user.findMany({
      where: { role: { in: roles }, ...(excludedId ? { id: { not: excludedId } } : {}) },
      orderBy: { name: 'asc' },
    });
    return staff.map((person) => ({ id: person.id, name: person.name, email: person.email }));
  }
}
