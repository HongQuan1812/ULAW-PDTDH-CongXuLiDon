/* Các bảng danh sách đơn (đơn của tôi, đơn phụ trách, Quản lí đơn), thống kê và CCCD người nộp.
   Chỉ làm việc với database; kiểm tra quyền nằm ở controller. Tìm, lọc, sắp xếp làm trong bộ nhớ bằng applyListQuery
   (đọc hết rồi lọc, như API giả); khi đơn nhiều và đo thấy chậm thì chuyển sang câu truy vấn SQL. */
import { Injectable } from '@nestjs/common';
import {
  FORM_LIST_DEFAULT_SORTING,
  FORM_LIST_FIELDS,
  FORM_STATUSES,
  HANDLED_FORM_LIST_FIELDS,
  MANAGED_FORM_LIST_FIELDS,
  applyListQuery,
  countDeadlineStates,
  formDeadline,
  maskCccd,
  type DeadlineState,
  type FormCccdsResponse,
  type FormStats,
  type FormSummary,
  type FormType,
  type HandledFormSummary,
  type HandledFormsResponse,
  type HolidayDates,
  type ListQuery,
  type ManagedFormSummary,
  type ManagedFormsResponse,
  type MyFormsResponse,
  formTypeStatusOf,
} from '@ulaw/shared';
import { PrismaService } from '../common/prisma.service';
import { toVietnamTime } from '../common/vietnam-time';
import { HolidaysService } from '../holidays/holidays.service';
import type { Form, FormEvent, Prisma, User } from '../generated/prisma/client';

/** Đếm ghi chú nội bộ kèm mỗi đơn (cột Ghi chú). */
const NOTE_COUNT = { _count: { select: { notes: true } } } as const;

/** Số ghi chú Prisma đếm kèm đơn. */
type WithNoteCount = { _count: { notes: number } };

/** Lịch sử đơn kèm mỗi đơn, cũ nhất trước, để tính tình trạng hạn (cột Tình trạng hạn). */
const DEADLINE_EVENTS = {
  events: { select: { action: true, at: true, status: true }, orderBy: [{ at: 'asc' as const }, { id: 'asc' as const }] },
} satisfies Prisma.FormInclude;

/** Lịch sử Prisma đọc kèm đơn. */
type WithDeadlineEvents = { events: Pick<FormEvent, 'action' | 'at' | 'status'>[] };

/** Đơn kèm hai cán bộ liên quan, số ghi chú và lịch sử, đủ để dựng dòng "Đơn phụ trách". */
type FormWithStaff = Form & WithNoteCount & WithDeadlineEvents & { receiver: User | null; handler: User | null };

@Injectable()
export class FormsService {
  /**
   * @param prisma    kết nối database
   * @param holidays  ngày nghỉ, để tính tình trạng hạn
   */
  constructor(
    private readonly prisma: PrismaService,
    private readonly holidays: HolidaysService,
  ) {}

  /**
   * Tình trạng hạn xử lí của đơn, tính như ở chi tiết đơn (formDeadline).
   * @param form          đơn kèm lịch sử, cũ nhất trước
   * @param holidayDates  các ngày nghỉ
   * @param now           bây giờ, giờ Việt Nam 'YYYY-MM-DDTHH:mm'
   * @returns             tình trạng hạn; null nếu loại đơn lúc nộp không có hạn
   */
  private deadlineStateOf(form: Form & WithDeadlineEvents, holidayDates: HolidayDates, now: string): DeadlineState | null {
    // Đơn nộp trước khi có hạn xử lí thì bản chụp không có mục này: coi như không có hạn
    const snapshot = form.formTypeSnapshot as unknown as Partial<FormType>;
    const history = form.events.map((event) => ({ action: event.action, at: toVietnamTime(event.at), status: event.status }));
    return formDeadline(snapshot.maxProcessingDays ?? null, history, now, holidayDates)?.state ?? null;
  }

  /**
   * Dựng một dòng tóm tắt của đơn.
   * @param form  đơn trong database
   * @returns     dòng theo FormSummarySchema (tên loại đơn lấy theo bản chụp lúc nộp)
   */
  private toSummary(form: Form): FormSummary {
    const snapshot = form.formTypeSnapshot as { name: string };
    return {
      code: form.code,
      formTypeId: form.formTypeId,
      formTypeName: snapshot.name,
      submittedAt: toVietnamTime(form.submittedAt),
      status: form.status,
    };
  }

  /**
   * Dựng dòng "Đơn phụ trách": tóm tắt kèm tình trạng hạn, người tiếp nhận, người xử lí, số ghi chú.
   * @param form          đơn kèm hai cán bộ, số ghi chú và lịch sử
   * @param holidayDates  các ngày nghỉ, để tính tình trạng hạn
   * @param now           bây giờ, giờ Việt Nam 'YYYY-MM-DDTHH:mm'
   * @returns             dòng theo HandledFormSummarySchema
   */
  private toHandledSummary(form: FormWithStaff, holidayDates: HolidayDates, now: string): HandledFormSummary {
    const toStaff = (staff: User | null) => (staff ? { id: staff.id, name: staff.name, email: staff.email } : null);
    return {
      ...this.toSummary(form),
      deadlineState: this.deadlineStateOf(form, holidayDates, now),
      receiver: toStaff(form.receiver),
      handler: toStaff(form.handler),
      noteCount: form._count.notes,
    };
  }

  /**
   * Dựng dòng bảng Quản lí đơn: tóm tắt kèm tình trạng hạn, lúc tiếp nhận, số ghi chú và người nộp (CCCD che).
   * @param form          đơn kèm người nộp, số ghi chú và lịch sử
   * @param holidayDates  các ngày nghỉ, để tính tình trạng hạn
   * @param now           bây giờ, giờ Việt Nam 'YYYY-MM-DDTHH:mm'
   * @returns             dòng theo ManagedFormSummarySchema
   */
  private toManagedSummary(form: Form & WithNoteCount & WithDeadlineEvents & { owner: User }, holidayDates: HolidayDates, now: string): ManagedFormSummary {
    const { owner } = form;
    return {
      ...this.toSummary(form),
      deadlineState: this.deadlineStateOf(form, holidayDates, now),
      receivedAt: form.receivedAt ? toVietnamTime(form.receivedAt) : null,
      noteCount: form._count.notes,
      applicant: { id: owner.id, name: owner.name, email: owner.email, phone: owner.phone, maskedCccd: maskCccd(owner.cccd) },
    };
  }

  /**
   * Một trang trong các đơn một người đã nộp.
   * @param ownerId    id người nộp
   * @param listQuery  trang, số dòng, tìm, sắp xếp, lọc
   * @returns          theo MyFormsResponseSchema
   */
  async findFormsOf(ownerId: string, listQuery: ListQuery): Promise<MyFormsResponse> {
    const forms = await this.prisma.form.findMany({ where: { ownerId } });
    const { rows, ...pageMeta } = applyListQuery(forms.map((form) => this.toSummary(form)), FORM_LIST_FIELDS, listQuery, FORM_LIST_DEFAULT_SORTING);
    return { forms: rows, ...pageMeta };
  }

  /**
   * Một trang trong các đơn một cán bộ đã tiếp nhận hoặc đang xử lí.
   * @param staffId    id cán bộ
   * @param listQuery  trang, số dòng, tìm, sắp xếp, lọc
   * @returns          theo HandledFormsResponseSchema
   */
  async findFormsHandledBy(staffId: string, listQuery: ListQuery): Promise<HandledFormsResponse> {
    const [forms, holidayDates] = await Promise.all([
      this.prisma.form.findMany({
        where: { OR: [{ receiverId: staffId }, { handlerId: staffId }] },
        include: { receiver: true, handler: true, ...NOTE_COUNT, ...DEADLINE_EVENTS },
      }),
      this.holidays.holidayDates(),
    ]);
    const now = toVietnamTime(new Date());
    const { rows, ...pageMeta } = applyListQuery(
      forms.map((form) => this.toHandledSummary(form, holidayDates, now)),
      HANDLED_FORM_LIST_FIELDS,
      listQuery,
      FORM_LIST_DEFAULT_SORTING,
    );
    return { forms: rows, ...pageMeta };
  }

  /**
   * Một trang trong mọi đơn của mọi người nộp (bảng Quản lí đơn).
   * @param listQuery       trang, số dòng, tìm, sắp xếp, lọc
   * @param canSearchCccd   người xem có quyền viewApplicant: tìm được theo số CCCD đầy đủ (ô CCCD vẫn che)
   * @returns               theo ManagedFormsResponseSchema
   */
  async findManaged(listQuery: ListQuery, canSearchCccd: boolean): Promise<ManagedFormsResponse> {
    const [forms, holidayDates] = await Promise.all([
      this.prisma.form.findMany({ include: { owner: true, ...NOTE_COUNT, ...DEADLINE_EVENTS } }),
      this.holidays.holidayDates(),
    ]);
    const now = toVietnamTime(new Date());
    const fullCccdByFormCode = new Map(forms.map((form) => [form.code, form.owner.cccd ?? '']));
    const { rows, ...pageMeta } = applyListQuery(
      forms.map((form) => this.toManagedSummary(form, holidayDates, now)),
      MANAGED_FORM_LIST_FIELDS,
      listQuery,
      FORM_LIST_DEFAULT_SORTING,
      canSearchCccd ? (row) => [fullCccdByFormCode.get(row.code) ?? ''] : undefined,
    );
    return { forms: rows, ...pageMeta };
  }

  /**
   * Đếm đơn theo trạng thái, theo loại đơn và theo tình trạng hạn, trên tất cả đơn.
   * @returns  tổng số đơn, số đơn mỗi trạng thái (đủ 6 trạng thái), số đơn mỗi loại đơn
   *           (nhiều nhất trước, bằng nhau thì theo tên; tên và trạng thái theo phiên bản mới nhất),
   *           số đơn mỗi tình trạng hạn và số đơn không có hạn
   */
  async getStats(): Promise<FormStats> {
    const [statusGroups, typeGroups, formTypes, formsWithEvents, holidayDates] = await Promise.all([
      this.prisma.form.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.form.groupBy({ by: ['formTypeId'], _count: { _all: true } }),
      this.prisma.formType.findMany({ include: { versions: { orderBy: { version: 'asc' } } } }),
      this.prisma.form.findMany({ include: DEADLINE_EVENTS }),
      this.holidays.holidayDates(),
    ]);

    const byStatus = Object.fromEntries(FORM_STATUSES.map((status) => [status, 0])) as FormStats['byStatus'];
    for (const group of statusGroups) byStatus[group.status] = group._count._all;
    const countByType = new Map(typeGroups.map((group) => [group.formTypeId, group._count._all]));

    const byType = formTypes
      .flatMap((formType) => {
        // Tên theo phiên bản mới nhất; trạng thái: có phiên bản nào đang mở thì cả loại đơn là Đang mở
        const latest = formType.versions[formType.versions.length - 1];
        if (!latest) return [];
        const formTypeStatus = formTypeStatusOf(formType.versions.map((version) => version.status));
        return [{ formTypeId: formType.id, formTypeName: latest.name, formTypeStatus, count: countByType.get(formType.id) ?? 0 }];
      })
      .sort((a, b) => b.count - a.count || a.formTypeName.localeCompare(b.formTypeName, 'vi'));

    // Tình trạng hạn: tính từng đơn như ở bảng, rồi đếm
    const now = toVietnamTime(new Date());
    const deadlineCounts = countDeadlineStates(formsWithEvents.map((form) => this.deadlineStateOf(form, holidayDates, now)));
    return { total: Object.values(byStatus).reduce((sum, count) => sum + count, 0), byStatus, byType, ...deadlineCounts };
  }

  /**
   * CCCD đầy đủ của những người nộp đơn đã hỏi.
   * @param userIds  id những người cần xem (đang có trên trang bảng)
   * @returns        CCCD theo id; người chưa có CCCD, hoặc chưa nộp đơn nào, thì không có mặt
   */
  async findCccds(userIds: readonly string[]): Promise<FormCccdsResponse> {
    const users = await this.prisma.user.findMany({
      where: { id: { in: [...userIds] }, cccd: { not: null }, forms: { some: {} } },
      select: { id: true, cccd: true },
    });
    return { cccds: Object.fromEntries(users.flatMap((user) => (user.cccd ? [[user.id, user.cccd]] : []))) };
  }
}
