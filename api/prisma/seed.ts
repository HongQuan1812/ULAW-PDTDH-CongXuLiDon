/* Dữ liệu mẫu cho database: cùng nguồn với API giả (shared/src/seed), nên cùng id người dùng, cùng mã đơn.
   Chạy: pnpm --filter api prisma db seed. Xóa sạch dữ liệu cũ rồi nạp lại, chỉ dùng khi phát triển. */
import { existsSync } from 'node:fs';
import { PrismaPg } from '@prisma/adapter-pg';
import {
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
import { PrismaClient, type Prisma } from '../src/generated/prisma/client';

// Khi phát triển biến nằm trong api/.env; trên máy chủ thì biến đặt sẵn
if (existsSync('.env')) process.loadEnvFile('.env');

/**
 * Đổi giờ Việt Nam 'YYYY-MM-DDTHH:mm' của dữ liệu mẫu thành thời điểm chính xác.
 * @param vietnamTime  giờ Việt Nam, vd '2026-10-30T07:00'
 * @returns            Date tương ứng (UTC+7)
 */
const toDate = (vietnamTime: string): Date => new Date(`${vietnamTime}:00+07:00`);

/**
 * Tách số thứ tự, năm, phiên bản khỏi mã đơn để dựng bộ đếm.
 * @param formCode  mã đơn dạng '<TIỀN TỐ>-<NĂM>-<PHIÊN BẢN>-<STT>', vd 'XMM-2026-001-01520'
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
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
try {
  // Dữ liệu mẫu phải thỏa mọi luật mới được nạp; kiểm tra trước khi xóa dữ liệu cũ để không mất dữ liệu vô ích
  assertSeedValid();
  await clearAll(prisma);
  await seedAll(prisma);
  console.log('Đã nạp dữ liệu mẫu.');
} finally {
  await prisma.$disconnect();
}
