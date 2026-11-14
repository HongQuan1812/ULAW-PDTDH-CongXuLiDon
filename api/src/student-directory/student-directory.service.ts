/* Thông tin sinh viên từ database trường (config/demo-apis.ts):
   bản giả dev-student-directory đọc bảng StudentInfo do seed điền · bản thật đọc database trường (chưa làm: chờ cách kết nối). */
import { Injectable } from '@nestjs/common';
import type { StudentInfo, StudentsResponse } from '@ulaw/shared';
import { PrismaService } from '../common/prisma.service';
import { AppConfig } from '../config/app-config';
import { realApiNotBuilt } from '../config/demo-apis';

@Injectable()
export class StudentDirectoryService {
  /**
   * @param prisma     kết nối database
   * @param appConfig  cấu hình, để biết dùng bản giả hay bản thật
   */
  constructor(
    private readonly prisma: PrismaService,
    private readonly appConfig: AppConfig,
  ) {}

  /**
   * Lấy các MSSV của một người dùng, MSSV trùng phần trước @ của email đứng đầu.
   * @param userId  id người dùng
   * @returns       các MSSV; không phải sinh viên thì []
   * @throws        501 khi dùng bản thật (chưa phát triển: chưa kết nối database trường)
   */
  async findStudents(userId: string): Promise<StudentInfo[]> {
    if (this.appConfig.usesDemoApi('dev-student-directory')) return this.findDevStudents(userId);

    // Bản thật: chưa phát triển (chờ cách kết nối database trường)
    throw realApiNotBuilt('dev-student-directory');
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
   * @param userId               id người dùng
   * @param chosenMainStudentId  MSSV chính người dùng đã chọn; null = chưa chọn
   * @returns                    MSSV chính là MSSV đã chọn nếu còn trong danh sách, không thì MSSV đầu; không có MSSV thì null
   */
  async findStudentsResponse(userId: string, chosenMainStudentId: string | null): Promise<StudentsResponse> {
    const students = await this.findStudents(userId);
    const chosen = students.find((student) => student.studentId === chosenMainStudentId);
    return { students, mainStudentId: (chosen ?? students[0])?.studentId ?? null };
  }
}
