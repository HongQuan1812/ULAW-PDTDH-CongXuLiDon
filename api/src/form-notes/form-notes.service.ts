/* Ghi chú nội bộ trên lá đơn: đọc, thêm, sửa, xóa, đếm. Quyền internalNotes đã được guard kiểm tra ở controller;
   ở đây kiểm tra đơn có tồn tại và người sửa, xóa là người viết (canEditFormNote). */
import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { FORM_NOTE_MESSAGES, canEditFormNote, type FormNote, type FormNotesResponse, type RichTextDoc } from '@ulaw/shared';
import { ApiException } from '../common/api-exception';
import { PrismaService } from '../common/prisma.service';
import { toVietnamTime } from '../common/vietnam-time';
import type { Prisma, User } from '../generated/prisma/client';

/** Lấy kèm người viết khi đọc ghi chú. */
const WITH_AUTHOR = { author: { select: { id: true, name: true, email: true } } } as const;

/** Dòng FormNote kèm người viết. */
type FormNoteWithAuthor = Prisma.FormNoteGetPayload<{ include: typeof WITH_AUTHOR }>;

/**
 * Đổi dòng database sang dạng hợp đồng API.
 * @param row  dòng FormNote kèm người viết
 * @returns    theo FormNoteSchema, thời điểm theo giờ Việt Nam
 */
function toFormNote(row: FormNoteWithAuthor): FormNote {
  return {
    id: row.id,
    content: row.content as unknown as RichTextDoc,
    author: row.author,
    createdAt: toVietnamTime(row.createdAt),
    editedAt: row.editedAt ? toVietnamTime(row.editedAt) : null,
  };
}

@Injectable()
export class FormNotesService {
  /** @param prisma  truy cập database */
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Kiểm tra lá đơn có tồn tại (cán bộ có quyền internalNotes xem được mọi đơn).
   * @param code  mã đơn
   * @throws      404 không có đơn
   */
  private async assertFormExists(code: string): Promise<void> {
    const form = await this.prisma.form.findUnique({ where: { code }, select: { code: true } });
    if (!form) throw new ApiException(404, FORM_NOTE_MESSAGES.formNotFound);
  }

  /**
   * Tìm ghi chú cần sửa, xóa và kiểm tra người đang đăng nhập là người viết.
   * @param code    mã đơn
   * @param noteId  id ghi chú
   * @param editor  người đang đăng nhập
   * @throws        404 không có đơn, không có ghi chú (hoặc ghi chú thuộc đơn khác) · 403 không phải người viết
   */
  private async assertEditable(code: string, noteId: string, editor: User): Promise<void> {
    await this.assertFormExists(code);
    const note = await this.prisma.formNote.findFirst({ where: { id: noteId, formCode: code }, select: { authorId: true } });
    if (!note) throw new ApiException(404, FORM_NOTE_MESSAGES.noteNotFound);
    if (!canEditFormNote(editor, { author: { id: note.authorId } })) throw new ApiException(403, FORM_NOTE_MESSAGES.notAuthor);
  }

  /**
   * Các ghi chú của một lá đơn.
   * @param code  mã đơn
   * @returns     cũ trước mới sau
   * @throws      404 không có đơn
   */
  async findNotes(code: string): Promise<FormNotesResponse> {
    await this.assertFormExists(code);
    const rows = await this.prisma.formNote.findMany({ where: { formCode: code }, include: WITH_AUTHOR, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
    return { notes: rows.map(toFormNote) };
  }

  /**
   * Thêm một ghi chú vào cuối chuỗi; người viết là người đang đăng nhập.
   * @param code     mã đơn
   * @param content  nội dung (đã kiểm tra không trống)
   * @param author   người đang đăng nhập
   * @returns        ghi chú mới
   * @throws         404 không có đơn
   */
  async addNote(code: string, content: RichTextDoc, author: User): Promise<FormNote> {
    await this.assertFormExists(code);
    const row = await this.prisma.formNote.create({
      data: { id: `note-${randomUUID()}`, formCode: code, authorId: author.id, content: content as unknown as Prisma.InputJsonValue },
      include: WITH_AUTHOR,
    });
    return toFormNote(row);
  }

  /**
   * Sửa nội dung ghi chú của mình, ghi lại lúc sửa.
   * @param code     mã đơn
   * @param noteId   id ghi chú
   * @param content  nội dung mới (đã kiểm tra không trống)
   * @param editor   người đang đăng nhập
   * @returns        ghi chú sau khi sửa
   * @throws         404 không có đơn, ghi chú · 403 không phải người viết
   */
  async updateNote(code: string, noteId: string, content: RichTextDoc, editor: User): Promise<FormNote> {
    await this.assertEditable(code, noteId, editor);
    const row = await this.prisma.formNote.update({
      where: { id: noteId },
      data: { content: content as unknown as Prisma.InputJsonValue, editedAt: new Date() },
      include: WITH_AUTHOR,
    });
    return toFormNote(row);
  }

  /**
   * Xóa ghi chú của mình.
   * @param code    mã đơn
   * @param noteId  id ghi chú
   * @param editor  người đang đăng nhập
   * @throws        404 không có đơn, ghi chú · 403 không phải người viết
   */
  async deleteNote(code: string, noteId: string, editor: User): Promise<void> {
    await this.assertEditable(code, noteId, editor);
    await this.prisma.formNote.delete({ where: { id: noteId } });
  }

  /**
   * Đếm ghi chú của nhiều lá đơn (cột Ghi chú của bảng đơn).
   * @param codes  các mã đơn
   * @returns      số ghi chú theo mã đơn, đủ mọi mã đã hỏi (mã không có, hoặc chưa có ghi chú thì 0)
   */
  async countNotes(codes: readonly string[]): Promise<Record<string, number>> {
    // Đếm theo đơn trong một câu truy vấn
    const groups = codes.length
      ? await this.prisma.formNote.groupBy({ by: ['formCode'], where: { formCode: { in: [...codes] } }, _count: { _all: true } })
      : [];
    const countByCode = new Map(groups.map((group) => [group.formCode, group._count._all]));

    // Đủ mọi mã đã hỏi
    return Object.fromEntries(codes.map((code) => [code, countByCode.get(code) ?? 0]));
  }
}
