/* Test nhóm API form-notes: ghi chú nội bộ trên lá đơn (xem, thêm, sửa, xóa, đếm).
   Cần database đã migrate và seed. Test ghi lại id các ghi chú đã thêm rồi xóa sạch khi xong. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import request, { type Response } from 'supertest';
import {
  ApiErrorBodySchema,
  DEMO_USER_IDS,
  EMPTY_RICH_TEXT_DOC,
  FORM_NOTE_MESSAGES,
  FormNoteCountsResponseSchema,
  FormNoteSchema,
  FormNotesResponseSchema,
  formNoteCountsPath,
  formNotePath,
  formNotesPath,
  plainTextToRichText,
  type FormNote,
  type RoleId,
} from '@ulaw/shared';
import { PrismaService } from '../src/common/prisma.service';
import { createTestApp } from './create-test-app';

/** Hai lá đơn có trong dữ liệu mẫu, và một mã đơn không có. */
const FORM_CODE = 'XMM-2026-001-01520';
const OTHER_FORM_CODE = 'XMM-2026-001-01500';
const MISSING_FORM_CODE = 'XMM-2026-001-99999';

/**
 * Câu báo lỗi trong body response, đúng dạng ApiErrorBody.
 * @param response  response lỗi
 * @returns         câu báo
 */
const messageOf = (response: Response) => ApiErrorBodySchema.parse(response.body).message;

describe('form-notes', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const createdNoteIds: string[] = [];
  const server = () => app.getHttpServer();

  /** Đăng nhập thử, trả cookie để gửi kèm các request sau. */
  async function loginAs(role: RoleId): Promise<string> {
    const response = await request(server()).post('/api/auth/dev-login').send({ role }).expect(200);
    return (response.headers['set-cookie'] as unknown as string[]).map((cookie) => cookie.split(';')[0]).join('; ');
  }

  /** Thêm một ghi chú (mong 201), ghi lại id để dọn. */
  async function addNote(cookie: string, text: string, code = FORM_CODE): Promise<FormNote> {
    const response = await request(server()).post(`/api${formNotesPath(code)}`).set('Cookie', cookie).send({ content: plainTextToRichText(text) }).expect(201);
    const note = FormNoteSchema.parse(response.body);
    createdNoteIds.push(note.id);
    return note;
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await prisma.formNote.deleteMany({ where: { id: { in: createdNoteIds } } });
    await app.close();
  });

  it('chưa đăng nhập: 401', async () => {
    const response = await request(server()).get(`/api${formNotesPath(FORM_CODE)}`).expect(401);
    expect(messageOf(response)).toBe(FORM_NOTE_MESSAGES[401]);
    await request(server()).get(`/api${formNoteCountsPath([FORM_CODE])}`).expect(401);
  });

  it('người nộp đơn (không có quyền internalNotes): 403, kể cả với đơn của mình', async () => {
    const cookie = await loginAs('nguoiNopDon');
    const listResponse = await request(server()).get(`/api${formNotesPath(FORM_CODE)}`).set('Cookie', cookie).expect(403);
    expect(messageOf(listResponse)).toBe(FORM_NOTE_MESSAGES[403]);
    await request(server()).post(`/api${formNotesPath(FORM_CODE)}`).set('Cookie', cookie).send({ content: plainTextToRichText('x') }).expect(403);
    await request(server()).get(`/api${formNoteCountsPath([FORM_CODE])}`).set('Cookie', cookie).expect(403);
  });

  it('không có đơn: 404', async () => {
    const cookie = await loginAs('nguoiXuLiDon');
    const response = await request(server()).get(`/api${formNotesPath(MISSING_FORM_CODE)}`).set('Cookie', cookie).expect(404);
    expect(messageOf(response)).toBe(FORM_NOTE_MESSAGES.formNotFound);
    await request(server()).post(`/api${formNotesPath(MISSING_FORM_CODE)}`).set('Cookie', cookie).send({ content: plainTextToRichText('x') }).expect(404);
  });

  it('nội dung trống, sai dạng: 422', async () => {
    const cookie = await loginAs('nguoiXuLiDon');
    const emptyResponse = await request(server()).post(`/api${formNotesPath(FORM_CODE)}`).set('Cookie', cookie).send({ content: EMPTY_RICH_TEXT_DOC }).expect(422);
    expect(messageOf(emptyResponse)).toBe(FORM_NOTE_MESSAGES.empty);
    const invalidResponse = await request(server()).post(`/api${formNotesPath(FORM_CODE)}`).set('Cookie', cookie).send({ content: 'chữ trơn' }).expect(422);
    expect(messageOf(invalidResponse)).toBe(FORM_NOTE_MESSAGES.invalidRequest);
  });

  it('thêm rồi xem: người viết là người đang đăng nhập, cũ trước mới sau, cán bộ khác cũng thấy', async () => {
    // Người xử lí đơn và admin cùng viết
    const handlerCookie = await loginAs('nguoiXuLiDon');
    const adminCookie = await loginAs('admin');
    const firstNote = await addNote(handlerCookie, 'Đã gọi điện cho sinh viên');
    const secondNote = await addNote(adminCookie, 'Chờ bảng điểm gốc');
    expect(firstNote.author.id).toBe(DEMO_USER_IDS.nguoiXuLiDon);
    expect(firstNote.editedAt).toBeNull();
    expect(firstNote.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);

    // Ai có quyền cũng thấy cả chuỗi, đúng thứ tự
    const response = await request(server()).get(`/api${formNotesPath(FORM_CODE)}`).set('Cookie', handlerCookie).expect(200);
    const noteIds = FormNotesResponseSchema.parse(response.body).notes.map((note) => note.id);
    expect(noteIds.indexOf(firstNote.id)).toBeLessThan(noteIds.indexOf(secondNote.id));
  });

  it('sửa, xóa: chỉ người viết; người khác 403; ghi chú không có hoặc của đơn khác 404', async () => {
    const handlerCookie = await loginAs('nguoiXuLiDon');
    const adminCookie = await loginAs('admin');
    const note = await addNote(handlerCookie, 'Bản đầu');

    // Người khác (kể cả admin) không sửa, xóa được
    const forbidden = await request(server()).patch(`/api${formNotePath(FORM_CODE, note.id)}`).set('Cookie', adminCookie).send({ content: plainTextToRichText('Sửa trộm') }).expect(403);
    expect(messageOf(forbidden)).toBe(FORM_NOTE_MESSAGES.notAuthor);
    await request(server()).delete(`/api${formNotePath(FORM_CODE, note.id)}`).set('Cookie', adminCookie).expect(403);

    // Sai đơn, sai id: 404
    const wrongForm = await request(server()).patch(`/api${formNotePath(OTHER_FORM_CODE, note.id)}`).set('Cookie', handlerCookie).send({ content: plainTextToRichText('x') }).expect(404);
    expect(messageOf(wrongForm)).toBe(FORM_NOTE_MESSAGES.noteNotFound);
    await request(server()).delete(`/api${formNotePath(FORM_CODE, 'note-khong-co')}`).set('Cookie', handlerCookie).expect(404);

    // Người viết sửa được, có ghi lúc sửa
    const editResponse = await request(server()).patch(`/api${formNotePath(FORM_CODE, note.id)}`).set('Cookie', handlerCookie).send({ content: plainTextToRichText('Bản sửa') }).expect(200);
    const editedNote = FormNoteSchema.parse(editResponse.body);
    expect(editedNote.content).toEqual(plainTextToRichText('Bản sửa'));
    expect(editedNote.editedAt).not.toBeNull();

    // Người viết xóa được, xóa rồi thì không còn
    await request(server()).delete(`/api${formNotePath(FORM_CODE, note.id)}`).set('Cookie', handlerCookie).expect(204);
    await request(server()).delete(`/api${formNotePath(FORM_CODE, note.id)}`).set('Cookie', handlerCookie).expect(404);
  });

  it('đếm: đủ mọi mã đã hỏi, mã không có thì 0', async () => {
    const cookie = await loginAs('nguoiXuLiDon');
    await addNote(cookie, 'Ghi chú để đếm', OTHER_FORM_CODE);
    const expectedCount = await prisma.formNote.count({ where: { formCode: OTHER_FORM_CODE } });

    const response = await request(server()).get(`/api${formNoteCountsPath([OTHER_FORM_CODE, MISSING_FORM_CODE])}`).set('Cookie', cookie).expect(200);
    expect(FormNoteCountsResponseSchema.parse(response.body).counts).toEqual({ [OTHER_FORM_CODE]: expectedCount, [MISSING_FORM_CODE]: 0 });

    // Không hỏi mã nào thì rỗng
    const emptyResponse = await request(server()).get(`/api${formNoteCountsPath([])}`).set('Cookie', cookie).expect(200);
    expect(emptyResponse.body).toEqual({ counts: {} });
  });
});
