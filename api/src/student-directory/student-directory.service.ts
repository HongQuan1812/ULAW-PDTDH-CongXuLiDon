/* Thông tin sinh viên từ database trường (config/demo-apis.ts):
   bản giả dev-student-directory đọc bảng StudentInfo do seed điền · bản thật đọc database trường theo email (school-database.service.ts). */
import { Injectable } from '@nestjs/common';
import type { StudentInfo, StudentsResponse } from '@ulaw/shared';
import { PrismaService } from '../common/prisma.service';
import { AppConfig } from '../config/app-config';
import type { User } from '../generated/prisma/client';
import { SchoolDatabaseService } from './school-database.service';

/** Người cần tra thông tin sinh viên: bản giả tra theo id, bản thật tra theo email. */
export type StudentOwner = Pick<User, 'id' | 'email'>;

@Injectable()
export class StudentDirectoryService {
  /**
   * @param prisma          kết nối database của cổng (bản giả đọc bảng mẫu)
   * @param appConfig       cấu hình, để biết dùng bản giả hay bản thật
   * @param schoolDatabase  kết nối database trường (bản thật)
   */
  constructor(
    private readonly prisma: PrismaService,
    private readonly appConfig: AppConfig,
    private readonly schoolDatabase: SchoolDatabaseService,
  ) {}

  /**
   * Lấy các MSSV của một người dùng, MSSV trùng phần trước @ của email đứng đầu.
   * @param owner  người dùng (id, email)
   * @returns      các MSSV; không phải sinh viên thì []
   * @throws       503 (bản thật) chưa cấu hình hoặc không đọc được database trường
   */
  async findStudents(owner: StudentOwner): Promise<StudentInfo[]> {
    if (this.appConfig.usesDemoApi('dev-student-directory')) return this.findDevStudents(owner.id);

    // Bản thật: tra database trường theo email đăng nhập
    return this.schoolDatabase.findStudentsByEmail(owner.email);
  }

  /* JUST FOR DEMO: START · dev-student-directory: bản giả, đọc bảng mẫu. Bản thật: đọc database trường */
  /**
   * Lấy các MSSV của một người dùng từ bảng StudentInfo do seed điền.
   * @param userId  id người dùng
   * @returns       các MSSV; không phải sinh viên thì []
   */
  private async findDevStudents(userId: string): Promise<StudentInfo[]> {
    const rows = await this.prisma.studentInfo.findMany({ where: { userId }, orderBy: { position: 'asc' } });
    return rows.map(({ studentId, className, trainingMode, major, currentCohort, originalCohort }) => ({
      studentId,
      className,
      trainingMode,
      major,
      currentCohort,
      originalCohort,
    }));
  }
  /* JUST FOR DEMO: END */

  /**
   * Lấy các MSSV kèm MSSV chính, theo hợp đồng StudentsResponse.
   * @param owner                người dùng (id, email)
   * @param chosenMainStudentId  MSSV chính người dùng đã chọn; null = chưa chọn
   * @returns                    MSSV chính là MSSV đã chọn nếu còn trong danh sách, không thì MSSV đầu; không có MSSV thì null
   */
  async findStudentsResponse(owner: StudentOwner, chosenMainStudentId: string | null): Promise<StudentsResponse> {
    const students = await this.findStudents(owner);
    const chosen = students.find((student) => student.studentId === chosenMainStudentId);
    return { students, mainStudentId: (chosen ?? students[0])?.studentId ?? null };
  }
}
