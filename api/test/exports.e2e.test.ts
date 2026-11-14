/* Test nhóm API exports: mẫu xuất file (danh sách, lưu, mẫu gốc, kiểm tra mã), xuất file một lá đơn (Word) và xuất thống kê (Excel).
   Cần database đã migrate và seed (mẫu tpl-demo của loại đơn xmm). Test thêm mẫu tên bắt đầu bằng TEST_NAME rồi xóa sạch khi xong. */
import ExcelJS from 'exceljs';
import PizZip from 'pizzip';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import request, { type Response } from 'supertest';
import {
  ApiErrorBodySchema,
  DOCX_CONTENT_TYPE,
  EXPORT_MESSAGES,
  EXPORT_TEMPLATE_FIELDS,
  ExportTemplateCheckSchema,
  ExportTemplatesResponseSchema,
  FORM_MESSAGES,
  FormTypeSchema,
  SEED_EXPORT_TEMPLATE,
  XLSX_CONTENT_TYPE,
  exportTemplatePath,
  exportTemplatesPath,
  formExportCheckPath,
  formExportPath,
  type ExportDraftRequest,
  type RoleId,
  type SaveExportTemplatesRequest,
} from '@ulaw/shared';
import { PrismaService } from '../src/common/prisma.service';
import { createTestApp } from './create-test-app';

/** Đơn của sv-1 (người nộp đơn khi đăng nhập thử) và đơn của sinh viên khác (sv-2), trong dữ liệu mẫu. */
const OWN_FORM_CODE = 'XMM-2026-001-01520';
const OTHER_FORM_CODE = 'XMM-2026-001-01500';

/** Tên các mẫu test thêm, để dọn sau. */
const TEST_NAME = 'Mẫu thử e2e';

/**
 * Đọc body nhị phân của response (supertest mặc định không gom body .docx).
 * @param response  response đang nhận (trong Node là luồng dữ liệu)
 * @param callback  báo xong, kèm nội dung
 */
function binaryParser(response: Response, callback: (error: Error | null, body: Buffer) => void): void {
  const stream = response as unknown as NodeJS.ReadableStream;
  const chunks: Buffer[] = [];
  stream.on('data', (chunk: Buffer) => chunks.push(chunk));
  stream.on('end', () => callback(null, Buffer.concat(chunks)));
}

/**
 * Chữ trơn trong thân file Word.
 * @param bytes  nội dung file .docx
 * @returns      chữ, bỏ thẻ XML
 */
function documentText(bytes: Buffer): string {
  return new PizZip(bytes).file('word/document.xml')!.asText().replace(/<[^>]+>/g, '');
}

/**
 * Câu báo lỗi trong body response, đúng dạng ApiErrorBody.
 * @param response  response lỗi
 * @returns         câu báo
 */
const messageOf = (response: Response) => ApiErrorBodySchema.parse(response.body).message;

describe('exports', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let sampleDocx: Buffer;
  let xmmDraft: ExportDraftRequest;
  const server = () => app.getHttpServer();

  /** Đăng nhập thử, trả cookie để gửi kèm các request sau. */
  async function loginAs(role: RoleId): Promise<string> {
    const response = await request(server()).post('/api/auth/login').send({ role }).expect(200);
    return (response.headers['set-cookie'] as unknown as string[]).map((cookie) => cookie.split(';')[0]).join('; ');
  }

  /** Gửi lưu các thay đổi về mẫu: phần chữ JSON và các file mới (id tạm → [tên file, nội dung]). */
  function saveTemplates(cookie: string, changes: SaveExportTemplatesRequest, files: Record<string, [string, Buffer]> = {}, formTypeId = 'xmm') {
    const call = request(server()).put(`/api${exportTemplatesPath(formTypeId)}`).set('Cookie', cookie).field(EXPORT_TEMPLATE_FIELDS.changes, JSON.stringify(changes));
    for (const [tempId, [fileName, content]] of Object.entries(files)) call.attach(tempId, content, fileName);
    return call;
  }

  /** Xóa các mẫu test đã thêm. */
  const cleanUp = () => prisma.exportTemplate.deleteMany({ where: { name: { startsWith: TEST_NAME } } });

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    await cleanUp();

    // Nội dung mẫu có sẵn và cấu trúc loại đơn xmm, dùng làm file tải lên và bản soạn
    sampleDocx = Buffer.from((await prisma.exportTemplate.findUniqueOrThrow({ where: { id: SEED_EXPORT_TEMPLATE.id } })).content);
    const studentCookie = await loginAs('nguoiNopDon');
    const xmm = FormTypeSchema.parse((await request(server()).get('/api/form-types/xmm').set('Cookie', studentCookie).expect(200)).body);
    xmmDraft = { name: xmm.name, prefix: 'XMM', sections: xmm.sections };
  });

  afterAll(async () => {
    await cleanUp();
    await app.close();
  });

  it('chưa đăng nhập: 401', async () => {
    const response = await request(server()).get(`/api${exportTemplatesPath('xmm')}`).expect(401);
    expect(messageOf(response)).toBe(EXPORT_MESSAGES[401]);
    await request(server()).post(`/api${formExportPath(OWN_FORM_CODE)}`).send({ templateId: SEED_EXPORT_TEMPLATE.id }).expect(401);
  });

  it('danh sách mẫu: ai đăng nhập cũng xem được', async () => {
    const cookie = await loginAs('nguoiNopDon');
    const response = await request(server()).get(`/api${exportTemplatesPath('xmm')}`).set('Cookie', cookie).expect(200);
    const { templates } = ExportTemplatesResponseSchema.parse(response.body);
    expect(templates.find((template) => template.id === SEED_EXPORT_TEMPLATE.id)).toMatchObject({
      name: SEED_EXPORT_TEMPLATE.name,
      fileName: SEED_EXPORT_TEMPLATE.fileName,
      uploadedAt: SEED_EXPORT_TEMPLATE.uploadedAt,
    });
  });

  it('quản lí mẫu khi không có quyền manageFormTypes: 403', async () => {
    const cookie = await loginAs('nguoiNopDon');
    const calls = [
      saveTemplates(cookie, { removed: [], renamed: [], added: [] }),
      request(server()).get(`/api${exportTemplatePath('xmm', SEED_EXPORT_TEMPLATE.id, 'file')}`).set('Cookie', cookie),
      request(server()).post(`/api${exportTemplatePath('xmm', SEED_EXPORT_TEMPLATE.id, 'check')}`).set('Cookie', cookie).send(xmmDraft),
      request(server()).post('/api/export-templates/check').set('Cookie', cookie),
      request(server()).post(`/api${exportTemplatePath('xmm', SEED_EXPORT_TEMPLATE.id, 'export')}`).set('Cookie', cookie),
    ];
    for (const call of calls) expect(messageOf(await call.expect(403))).toBe(EXPORT_MESSAGES[403]);
  });

  it('mẫu gốc: trả file .docx còn nguyên, tên file lúc tải lên', async () => {
    const cookie = await loginAs('nguoiXuLiDon');
    const response = await request(server())
      .get(`/api${exportTemplatePath('xmm', SEED_EXPORT_TEMPLATE.id, 'file')}`)
      .set('Cookie', cookie)
      .buffer(true)
      .parse(binaryParser)
      .expect(200);
    expect(response.headers['content-type']).toContain(DOCX_CONTENT_TYPE);
    expect(response.headers['content-disposition']).toContain(encodeURIComponent(SEED_EXPORT_TEMPLATE.fileName));
    expect(Buffer.compare(response.body as Buffer, sampleDocx)).toBe(0);

    // Loại đơn, mẫu không có: 404
    const noFormType = await request(server()).get(`/api${exportTemplatePath('khong-co', SEED_EXPORT_TEMPLATE.id, 'file')}`).set('Cookie', cookie).expect(404);
    expect(messageOf(noFormType)).toBe(EXPORT_MESSAGES.formTypeNotFound);
    const noTemplate = await request(server()).get(`/api${exportTemplatePath('xmm', 'khong-co', 'file')}`).set('Cookie', cookie).expect(404);
    expect(messageOf(noTemplate)).toBe(EXPORT_MESSAGES.templateNotFound);
  });

  it('kiểm tra mã mẫu đã lưu: mọi mã đều có trong loại đơn; bản soạn sai dạng thì 422', async () => {
    const cookie = await loginAs('nguoiXuLiDon');
    const path = `/api${exportTemplatePath('xmm', SEED_EXPORT_TEMPLATE.id, 'check')}`;
    const check = ExportTemplateCheckSchema.parse((await request(server()).post(path).set('Cookie', cookie).send(xmmDraft).expect(200)).body);
    expect(check).toMatchObject({ unknown: [], outside: [], error: '' });
    expect(check.found).toContain('ho_ten');

    const invalid = await request(server()).post(path).set('Cookie', cookie).send({ sections: 'sai' }).expect(422);
    expect(messageOf(invalid)).toBe(EXPORT_MESSAGES.invalidRequest);
  });

  it('kiểm tra mã file chưa lưu: đọc được file gửi kèm; không phải .docx thì 422', async () => {
    const cookie = await loginAs('nguoiXuLiDon');
    const checkFile = (fileName: string, content: Buffer) =>
      request(server())
        .post('/api/export-templates/check')
        .set('Cookie', cookie)
        .field(EXPORT_TEMPLATE_FIELDS.draft, JSON.stringify(xmmDraft))
        .attach(EXPORT_TEMPLATE_FIELDS.file, content, fileName);

    const check = ExportTemplateCheckSchema.parse((await checkFile('mẫu mới.docx', sampleDocx).expect(200)).body);
    expect(check).toMatchObject({ unknown: [], outside: [], error: '' });

    expect(messageOf(await checkFile('mau.doc', sampleDocx).expect(422))).toBe(EXPORT_MESSAGES.notTemplateFile);
    expect(messageOf(await checkFile('hong.docx', Buffer.from('không phải docx')).expect(422))).toBe(EXPORT_MESSAGES.unreadable);
  });

  it('lưu các mẫu: thêm, đổi tên, xóa trong một lần', async () => {
    const cookie = await loginAs('nguoiXuLiDon');

    // Thêm hai mẫu; tên file có dấu vẫn giữ đúng chữ
    const added = ExportTemplatesResponseSchema.parse(
      (
        await saveTemplates(
          cookie,
          { removed: [], renamed: [], added: [{ tempId: 'local-1', name: `${TEST_NAME} 1`, purpose: 'form' }, { tempId: 'local-2', name: `  ${TEST_NAME} 2 `, purpose: 'form' }] },
          { 'local-1': ['mẫu một.docx', sampleDocx], 'local-2': ['mau-hai.docx', sampleDocx] },
        ).expect(200)
      ).body,
    ).templates;
    const [first, second] = added.filter((template) => template.name.startsWith(TEST_NAME));
    expect(first).toMatchObject({ name: `${TEST_NAME} 1`, fileName: 'mẫu một.docx', sizeBytes: sampleDocx.byteLength });
    expect(second).toMatchObject({ name: `${TEST_NAME} 2`, fileName: 'mau-hai.docx' });

    // Xóa mẫu thứ nhất, đổi tên mẫu thứ hai
    const saved = ExportTemplatesResponseSchema.parse(
      (await saveTemplates(cookie, { removed: [first!.id], renamed: [{ templateId: second!.id, name: `${TEST_NAME} đổi tên` }], added: [] }).expect(200)).body,
    ).templates;
    expect(saved.map((template) => template.id)).not.toContain(first!.id);
    expect(saved.find((template) => template.id === second!.id)?.name).toBe(`${TEST_NAME} đổi tên`);
  });

  it('lưu các mẫu: sai một chỗ thì không lưu gì', async () => {
    const cookie = await loginAs('nguoiXuLiDon');
    const countTestTemplates = () => prisma.exportTemplate.count({ where: { name: { startsWith: TEST_NAME } } });
    const before = await countTestTemplates();
    const goodFile: Record<string, [string, Buffer]> = { 'local-1': ['tot.docx', sampleDocx] };

    // Thiếu file của mẫu mới
    const missing = await saveTemplates(cookie, {
      removed: [],
      renamed: [],
      added: [{ tempId: 'local-1', name: `${TEST_NAME} có file`, purpose: 'form' }, { tempId: 'local-2', name: `${TEST_NAME} thiếu file`, purpose: 'form' }],
    }, goodFile).expect(422);
    expect(messageOf(missing)).toBe(EXPORT_MESSAGES.fileMissing(`${TEST_NAME} thiếu file`));

    // Mẫu cần xóa không còn
    const gone = await saveTemplates(cookie, { removed: ['khong-co'], renamed: [], added: [{ tempId: 'local-1', name: `${TEST_NAME} x`, purpose: 'form' }] }, goodFile).expect(404);
    expect(messageOf(gone)).toBe(EXPORT_MESSAGES.templateNotFound);

    // Phần chữ sai dạng, loại đơn không có
    const invalid = await saveTemplates(cookie, { removed: [], renamed: [], added: [{ tempId: 'local-1', name: '   ', purpose: 'form' }] }, goodFile).expect(422);
    expect(messageOf(invalid)).toBe(EXPORT_MESSAGES.invalidRequest);
    const noFormType = await saveTemplates(cookie, { removed: [], renamed: [], added: [] }, {}, 'khong-co').expect(404);
    expect(messageOf(noFormType)).toBe(EXPORT_MESSAGES.formTypeNotFound);

    expect(await countTestTemplates()).toBe(before);
  });

  it('xuất file đơn của mình: điền họ tên, mã đơn, không còn mã trong ngoặc', async () => {
    const cookie = await loginAs('nguoiNopDon');
    const response = await request(server())
      .post(`/api${formExportPath(OWN_FORM_CODE)}`)
      .set('Cookie', cookie)
      .send({ templateId: SEED_EXPORT_TEMPLATE.id })
      .buffer(true)
      .parse(binaryParser)
      .expect(200);
    expect(response.headers['content-type']).toContain(DOCX_CONTENT_TYPE);
    expect(response.headers['content-disposition']).toContain(`${OWN_FORM_CODE}_`);

    const owner = await prisma.user.findUniqueOrThrow({ where: { id: 'sv-1' } });
    const text = documentText(response.body as Buffer);
    expect(text).toContain(owner.name);
    expect(text).toContain(OWN_FORM_CODE);
    expect(text).not.toMatch(/\{[#/]?[a-z_]+\}/);
  });

  it('xuất file: đơn người khác 404 với người nộp đơn, cán bộ xem mọi đơn thì xuất được', async () => {
    const exportOther = (cookie: string, templateId: string = SEED_EXPORT_TEMPLATE.id) =>
      request(server()).post(`/api${formExportPath(OTHER_FORM_CODE)}`).set('Cookie', cookie).send({ templateId });

    const student = await loginAs('nguoiNopDon');
    expect(messageOf(await exportOther(student).expect(404))).toBe(FORM_MESSAGES.notFound);
    expect(FORM_MESSAGES.notFound).toBe(EXPORT_MESSAGES.formNotFound);

    const staff = await loginAs('nguoiXuLiDon');
    await exportOther(staff).expect(200);
    expect(messageOf(await exportOther(staff, 'khong-co').expect(404))).toBe(EXPORT_MESSAGES.templateNotFound);

    const invalid = await request(server()).post(`/api${formExportPath(OTHER_FORM_CODE)}`).set('Cookie', staff).send({}).expect(422);
    expect(messageOf(invalid)).toBe(EXPORT_MESSAGES.invalidRequest);
  });

  it('kiểm tra mã của mẫu theo đơn: người xem đơn được kiểm, đơn người khác 404, mẫu không có 404', async () => {
    const checkOther = (cookie: string, templateId: string = SEED_EXPORT_TEMPLATE.id) =>
      request(server()).post(`/api${formExportCheckPath(OTHER_FORM_CODE)}`).set('Cookie', cookie).send({ templateId });
    const student = await loginAs('nguoiNopDon');

    // Đơn của mình: kiểm tra được kể cả khi không có quyền quản lí loại đơn; kết quả đúng dạng ExportTemplateCheck
    const own = await request(server())
      .post(`/api${formExportCheckPath(OWN_FORM_CODE)}`)
      .set('Cookie', student)
      .send({ templateId: SEED_EXPORT_TEMPLATE.id })
      .expect(200);
    const check = ExportTemplateCheckSchema.parse(own.body);
    expect(check.found.length).toBeGreaterThan(0);

    // Đơn người khác thì 404 với người nộp đơn, cán bộ thì kiểm được; mẫu không có thì 404; body sai thì 422
    expect(messageOf(await checkOther(student).expect(404))).toBe(EXPORT_MESSAGES.formNotFound);
    const staff = await loginAs('nguoiXuLiDon');
    await checkOther(staff).expect(200);
    expect(messageOf(await checkOther(staff, 'khong-co').expect(404))).toBe(EXPORT_MESSAGES.templateNotFound);
    await request(server()).post(`/api${formExportCheckPath(OTHER_FORM_CODE)}`).set('Cookie', staff).send({}).expect(422);
    await request(server()).post(`/api${formExportCheckPath(OWN_FORM_CODE)}`).send({ templateId: SEED_EXPORT_TEMPLATE.id }).expect(401);
  });

  it('mẫu thống kê: lưu file .xlsx, kiểm tra mã, xuất mọi đơn của loại đơn mỗi đơn một hàng', async () => {
    const cookie = await loginAs('nguoiXuLiDon');

    // Mẫu: hàng 1 tiêu đề (mã chung), hàng 2 hàng mẫu của đơn
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Thống kê');
    sheet.addRow(['{loai_don}: {so_don} đơn']);
    sheet.addRow(['{stt}', '{ma_don}', '{ho_ten}', '{trang_thai}']);
    const sampleXlsx = Buffer.from(await workbook.xlsx.writeBuffer());

    // Mẫu thống kê phải là .xlsx
    const wrongType = await saveTemplates(cookie, { removed: [], renamed: [], added: [{ tempId: 'local-1', name: `${TEST_NAME} sai`, purpose: 'stats' }] }, { 'local-1': ['sai.docx', sampleDocx] }).expect(422);
    expect(messageOf(wrongType)).toBe(EXPORT_MESSAGES.notXlsx);

    // Lưu mẫu thống kê
    const saved = ExportTemplatesResponseSchema.parse(
      (await saveTemplates(cookie, { removed: [], renamed: [], added: [{ tempId: 'local-1', name: `${TEST_NAME} thống kê`, purpose: 'stats' }] }, { 'local-1': ['thong-ke.xlsx', sampleXlsx] }).expect(200)).body,
    ).templates;
    const statsTemplate = saved.find((template) => template.name === `${TEST_NAME} thống kê`)!;
    expect(statsTemplate.purpose).toBe('stats');

    // Kiểm tra mã: mọi mã đều dùng được
    const check = ExportTemplateCheckSchema.parse(
      (await request(server()).post(`/api${exportTemplatePath('xmm', statsTemplate.id, 'check')}`).set('Cookie', cookie).send(xmmDraft).expect(200)).body,
    );
    expect(check).toMatchObject({ unknown: [], error: '' });

    // Xuất mọi phiên bản: mỗi phiên bản một sheet, mỗi đơn một hàng theo thứ tự nộp
    const exportStats = (body: unknown) =>
      request(server()).post(`/api${exportTemplatePath('xmm', statsTemplate.id, 'export')}`).set('Cookie', cookie).send(body as object).buffer(true).parse(binaryParser);
    const openWorkbook = async (response: Response) => {
      const opened = new ExcelJS.Workbook();
      await opened.xlsx.load(new Uint8Array(response.body as Buffer).buffer);
      return opened;
    };
    const everything = await exportStats({ version: 'all', submittedFrom: null, submittedTo: null }).expect(200);
    expect(everything.headers['content-type']).toContain(XLSX_CONTENT_TYPE);
    const forms = await prisma.form.findMany({ where: { formTypeId: 'xmm' }, orderBy: [{ submittedAt: 'asc' }, { code: 'asc' }], select: { code: true, formTypeVersion: true, submittedAt: true } });
    const versions = (await prisma.formTypeVersion.findMany({ where: { formTypeId: 'xmm', status: { not: 'draft' } }, orderBy: { version: 'asc' } })).map((version) => version.version);
    const everythingBook = await openWorkbook(everything);
    expect(everythingBook.worksheets.map((worksheet) => worksheet.name)).toEqual(versions.map((version) => `Phiên bản ${version}`));
    const firstVersionForms = forms.filter((form) => form.formTypeVersion === versions[0]);
    const firstSheet = everythingBook.worksheets[0]!;
    expect(String(firstSheet.getCell('A1').value)).toContain(`${firstVersionForms.length} đơn`);
    expect(firstSheet.getCell('A2').value).toBe(1);
    expect(firstSheet.getCell('B2').value).toBe(firstVersionForms[0]!.code);
    expect(firstSheet.getCell(`B${firstVersionForms.length + 1}`).value).toBe(firstVersionForms.at(-1)!.code);

    // Chọn một phiên bản: một sheet; lọc theo ngày nộp
    const single = await openWorkbook(await exportStats({ version: versions[0], submittedFrom: null, submittedTo: null }).expect(200));
    expect(single.worksheets.map((worksheet) => worksheet.name)).toEqual([`Phiên bản ${versions[0]}`]);
    const ranged = await openWorkbook(await exportStats({ version: 'all', submittedFrom: '2999-01-01', submittedTo: null }).expect(200));
    expect(String(ranged.worksheets[0]!.getCell('A1').value)).toContain('0 đơn');

    // Sai điều kiện: phiên bản không có 404; body thiếu hoặc sai 422
    const exportStatsJson = (body: object) => request(server()).post(`/api${exportTemplatePath('xmm', statsTemplate.id, 'export')}`).set('Cookie', cookie).send(body);
    expect(messageOf(await exportStatsJson({ version: 999, submittedFrom: null, submittedTo: null }).expect(404))).toBe(EXPORT_MESSAGES.versionNotFound);
    await exportStatsJson({}).expect(422);
    await exportStatsJson({ version: 'all', submittedFrom: '2026-03-01', submittedTo: '2026-02-01' }).expect(422);

    // Mẫu thống kê không dùng để xuất file một lá đơn, và ngược lại
    await request(server()).post(`/api${formExportPath(OTHER_FORM_CODE)}`).set('Cookie', cookie).send({ templateId: statsTemplate.id }).expect(404);
    await request(server()).post(`/api${exportTemplatePath('xmm', SEED_EXPORT_TEMPLATE.id, 'export')}`).set('Cookie', cookie).send({ version: 'all', submittedFrom: null, submittedTo: null }).expect(404);
  });
});
