import { describe, expect, it, vi } from 'vitest';
import type { StudentInfo } from '@ulaw/shared';
import type { PrismaService } from '../common/prisma.service';
import type { AppConfig } from '../config/app-config';
import type { SchoolDatabaseService } from './school-database.service';
import { StudentDirectoryService } from './student-directory.service';

const OWNER = { id: 'sv-1', email: '2253801011001@email.hcmulaw.edu.vn' };
const SCHOOL_STUDENT: StudentInfo = {
  studentId: '2253801011001',
  className: '178-HC50(A)',
  trainingMode: 'Chính quy',
  major: 'Luật',
  currentCohort: 'Khóa 47',
  originalCohort: null,
};

/**
 * Dựng service với database trường giả.
 * @param usesDemo  true: bản giả dev-student-directory · false: bản thật
 * @returns         service và hàm tra database trường giả (để kiểm tra đã gọi với email nào)
 */
function serviceWith(usesDemo: boolean) {
  const findStudentsByEmail = vi.fn(async () => [SCHOOL_STUDENT]);
  const findMany = vi.fn(async () => []);
  const service = new StudentDirectoryService(
    { studentInfo: { findMany } } as unknown as PrismaService,
    { usesDemoApi: () => usesDemo } as unknown as AppConfig,
    { findStudentsByEmail } as unknown as SchoolDatabaseService,
  );
  return { service, findStudentsByEmail, findMany };
}

describe('StudentDirectoryService', () => {
  it('bản thật: tra database trường theo email, không đọc bảng mẫu', async () => {
    const { service, findStudentsByEmail, findMany } = serviceWith(false);

    expect(await service.findStudents(OWNER)).toEqual([SCHOOL_STUDENT]);
    expect(findStudentsByEmail).toHaveBeenCalledWith(OWNER.email);
    expect(findMany).not.toHaveBeenCalled();
  });

  it('bản giả: đọc bảng mẫu theo id, không gọi database trường', async () => {
    const { service, findStudentsByEmail, findMany } = serviceWith(true);

    await service.findStudents(OWNER);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: OWNER.id } }));
    expect(findStudentsByEmail).not.toHaveBeenCalled();
  });

  it('MSSV chính: MSSV đã chọn nếu còn trong danh sách, không thì MSSV đầu', async () => {
    const { service } = serviceWith(false);

    expect((await service.findStudentsResponse(OWNER, 'mssv-cu')).mainStudentId).toBe(SCHOOL_STUDENT.studentId);
    expect((await service.findStudentsResponse(OWNER, null)).students).toHaveLength(1);
  });
});
