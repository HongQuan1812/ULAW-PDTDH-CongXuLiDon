/* Thông tin sinh viên "từ database trường". Bản giả: đọc bảng StudentInfo do seed điền.
   Bản thật thay phần ruột của service này bằng kết nối database trường, nơi khác không phải sửa. */
import { Injectable } from '@nestjs/common';
import type { StudentInfo, StudentsResponse } from '@ulaw/shared';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class StudentDirectoryService {
  /**
   * @param prisma  kết nối database
   */
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lấy các MSSV của một người dùng, MSSV trùng phần trước @ của email đứng đầu.
   * @param userId  id người dùng
   * @returns       các MSSV; không phải sinh viên thì []
   */
  async findStudents(userId: string): Promise<StudentInfo[]> {
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
