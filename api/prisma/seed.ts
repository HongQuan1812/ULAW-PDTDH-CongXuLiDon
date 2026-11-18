/* Dữ liệu mẫu cho database: cùng nguồn với API giả (shared/src/seed), nên cùng id người dùng, cùng mã đơn.
   Chạy: pnpm --filter api prisma db seed. Xóa sạch dữ liệu cũ (database, tệp tải lên, bản sao lưu) rồi nạp lại, chỉ dùng khi phát triển. */
import { readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  BACKUP_SCHEDULES_SEED,
  BACKUP_TARGETS_SEED,
  EMAIL_SETTINGS_SEED,
  EMAIL_SETTINGS_SEED_UPDATE,
  SAMPLE_EXPORT_TEMPLATE_BASE64,
  SEED_ACCOUNTS,
  SEED_EXPORT_TEMPLATE,
  SEED_FILE_ID_PREFIX,
  assertSeedValid,
  STUDENT_DIRECTORY,
  seedFormTypes,
  seedForms,
} from '@ulaw/shared';
import { DEFAULT_BACKUP_DIR, DEFAULT_UPLOAD_DIR } from '../src/config/app-config';
import { loadDevEnvFile } from '../src/config/env-file';
import { PrismaClient, type Prisma } from '../src/generated/prisma/client';

// Biến môi trường: .env.dev khi chạy trên máy, compose truyền vào khi chạy container
loadDevEnvFile();

/**
 * Đổi giờ Việt Nam 'YYYY-MM-DDTHH:mm' của dữ liệu mẫu thành thời điểm chính xác.
 * @param vietnamTime  giờ Việt Nam, vd '2026-10-30T07:00'
 * @returns            Date tương ứng (UTC+7)
 */
const toDate = (vietnamTime: string): Date => new Date(`${vietnamTime}:00+07:00`);

/**
 * Tách số thứ tự, năm, phiên bản khỏi mã đơn để dựng bộ đếm.
 * @param formCode  mã đơn dạng '<TIỀN TỐ>-<NĂM>-<PHIÊN BẢN>-<STT>', vd 'XMR-2026-001-01520'
 * @returns         tiền tố, năm, phiên bản, số thứ tự
 */
function parseFormCode(formCode: string): { prefix: string; year: number; version: number; sequence: number } {
  const [prefix, year, version, sequence] = formCode.split('-');
  return { prefix: prefix!, year: Number(year), version: Number(version), sequence: Number(sequence) };
}

/**
 * Xóa sạch mọi bảng (con trước, cha sau).
 * @param prisma  Prisma Client
 */
async function clearAll(prisma: PrismaClient): Promise<void> {
  await prisma.$transaction([
    prisma.authSession.deleteMany(),
    prisma.backupRun.deleteMany(),
    prisma.backupTarget.deleteMany(),
    prisma.backupSchedule.deleteMany(),
    prisma.fileObject.deleteMany(),
    prisma.form.deleteMany(),
    prisma.formCodeCounter.deleteMany(),
    prisma.exportTemplate.deleteMany(),
    prisma.formTypeVersion.deleteMany(),
    prisma.formType.deleteMany(),
    prisma.emailSettings.deleteMany(),
    prisma.studentInfo.deleteMany(),
    prisma.user.deleteMany(),
  ]);
}

/**
 * Xóa mọi thứ bên trong một thư mục, giữ lại chính thư mục đó (có thể là chỗ gắn volume). Thư mục chưa có thì bỏ qua.
 * Không dọn thư mục đang chạy hoặc thư mục cha của nó, phòng đặt nhầm biến (vd UPLOAD_DIR=.).
 * @param dir  đường dẫn thư mục, tương đối với thư mục chạy seed (api/) hoặc tuyệt đối
 * @returns    số mục đã xóa
 */
async function emptyDir(dir: string): Promise<number> {
  // Chặn đường dẫn nguy hiểm
  const absoluteDir = path.resolve(dir);
  const fromDirToCwd = path.relative(absoluteDir, process.cwd());
  if (!fromDirToCwd.startsWith('..') && !path.isAbsolute(fromDirToCwd)) {
    throw new Error(`Không dọn "${absoluteDir}": là thư mục đang chạy hoặc thư mục cha của nó.`);
  }

  // Xóa từng mục bên trong
  const entries = await readdir(absoluteDir).catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') return [];
    throw error;
  });
  await Promise.all(entries.map((entry) => rm(path.join(absoluteDir, entry), { recursive: true, force: true })));
  return entries.length;
}

/**
 * Dọn tệp tải lên (UPLOAD_DIR) và bản sao lưu trên máy chủ (BACKUP_DIR). Bản sao lưu trên Google Drive không đụng tới.
 * @returns  số mục đã xóa ở mỗi thư mục
 */
async function clearStorage(): Promise<{ uploads: number; backups: number }> {
  return {
    uploads: await emptyDir(process.env.UPLOAD_DIR || DEFAULT_UPLOAD_DIR),
    backups: await emptyDir(process.env.BACKUP_DIR || DEFAULT_BACKUP_DIR),
  };
}

/**
 * Nạp toàn bộ dữ liệu mẫu theo thứ tự khóa ngoại.
 * @param prisma  Prisma Client
 */
async function seedAll(prisma: PrismaClient): Promise<void> {
  // Tài khoản và thông tin sinh viên
  await prisma.user.createMany({
    data: Object.entries(SEED_ACCOUNTS).map(([id, account]) => ({ id, ...account })),
  });
  await prisma.studentInfo.createMany({
    data: Object.entries(STUDENT_DIRECTORY).flatMap(([userId, students]) =>
      students.map((student, position) => ({ userId, position, ...student })),
    ),
  });

  // Loại đơn và các phiên bản
  const formTypes = seedFormTypes();
  await prisma.formType.createMany({ data: formTypes.map(({ id, prefix }) => ({ id, prefix })) });
  await prisma.formTypeVersion.createMany({
    data: formTypes.flatMap((formType) =>
      formType.versions.map(({ updatedAt, sections, ...version }) => ({
        ...version,
        formTypeId: formType.id,
        sections: sections as unknown as Prisma.InputJsonValue,
        updatedAt: toDate(updatedAt),
      })),
    ),
  });

  // Lá đơn, bộ đếm mã đơn, tệp mẫu
  const forms = seedForms();
  await prisma.form.createMany({
    data: forms.map((form) => ({
      code: form.code,
      ownerId: form.ownerId,
      formTypeId: form.formTypeId,
      formTypeVersion: parseFormCode(form.code).version,
      status: form.status,
      submittedAt: toDate(form.submittedAt),
      updatedAt: toDate(form.updatedAt),
      decidedAt: form.status === 'duyet' || form.status === 'tc' ? toDate(form.decidedAt ?? form.updatedAt) : null,
      note: form.note,
      receiverId: form.receiverId,
      receivedAt: form.receivedAt ? toDate(form.receivedAt) : null,
      handlerId: form.handlerId,
      handlerSince: form.handlerSince ? toDate(form.handlerSince) : null,
      answers: form.answers as unknown as Prisma.InputJsonValue,
      formTypeSnapshot: form.formTypeSnapshot as unknown as Prisma.InputJsonValue,
    })),
  });

  const lastSequenceByKey = new Map<string, ReturnType<typeof parseFormCode>>();
  for (const { code } of forms) {
    const parsed = parseFormCode(code);
    const key = `${parsed.prefix}-${parsed.year}-${parsed.version}`;
    if (parsed.sequence > (lastSequenceByKey.get(key)?.sequence ?? 0)) lastSequenceByKey.set(key, parsed);
  }
  await prisma.formCodeCounter.createMany({
    data: [...lastSequenceByKey.values()].map(({ prefix, year, version, sequence }) => ({ prefix, year, version, last: sequence })),
  });

  await prisma.fileObject.createMany({
    data: forms.flatMap((form) =>
      // Mọi tệp mẫu trong câu trả lời (câu hỏi tải tệp có id tùy loại đơn): mảng gồm các đối tượng có id bắt đầu bằng tiền tố tệp mẫu
      Object.values(form.answers)
        .flatMap((answer) => (Array.isArray(answer) ? answer : []))
        .filter((file): file is { id: string; name: string; sizeBytes: number } => typeof file === 'object' && file !== null && !Array.isArray(file) && 'sizeBytes' in file)
        .filter((file) => file.id.startsWith(SEED_FILE_ID_PREFIX))
        .map((file) => ({ id: file.id, formCode: form.code, name: file.name, sizeBytes: file.sizeBytes, storagePath: null, uploadedAt: toDate(form.submittedAt) })),
    ),
  });

  // Mẫu xuất file và cấu hình email
  const templateBytes = Buffer.from(SAMPLE_EXPORT_TEMPLATE_BASE64, 'base64');
  await prisma.exportTemplate.create({
    data: {
      id: SEED_EXPORT_TEMPLATE.id,
      formTypeId: SEED_EXPORT_TEMPLATE.formTypeId,
      name: SEED_EXPORT_TEMPLATE.name,
      fileName: SEED_EXPORT_TEMPLATE.fileName,
      sizeBytes: templateBytes.byteLength,
      content: templateBytes,
      uploadedAt: toDate(SEED_EXPORT_TEMPLATE.uploadedAt),
      uploadedById: SEED_EXPORT_TEMPLATE.uploadedById,
    },
  });
  await prisma.emailSettings.create({
    data: {
      id: 1,
      settings: EMAIL_SETTINGS_SEED as unknown as Prisma.InputJsonValue,
      updatedAt: toDate(EMAIL_SETTINGS_SEED_UPDATE.updatedAt),
      updatedById: EMAIL_SETTINGS_SEED_UPDATE.updatedById,
    },
  });

  // Sao lưu: nơi lưu và lịch mẫu, chưa có lần sao lưu nào
  await prisma.backupTarget.createMany({ data: [...BACKUP_TARGETS_SEED] });
  await prisma.backupSchedule.createMany({ data: BACKUP_SCHEDULES_SEED.map((schedule) => ({ ...schedule })) });
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
try {
  // Dữ liệu mẫu phải thỏa mọi luật mới được nạp; kiểm tra trước khi xóa dữ liệu cũ để không mất dữ liệu vô ích
  assertSeedValid();
  await clearAll(prisma);
  const cleared = await clearStorage();
  await seedAll(prisma);
  console.log(`Đã nạp dữ liệu mẫu (xóa ${cleared.uploads} mục tệp tải lên, ${cleared.backups} mục sao lưu).`);
} finally {
  await prisma.$disconnect();
}
