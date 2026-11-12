/* Hồ sơ cá nhân: đọc, lưu họ tên / CCCD / SĐT, chọn MSSV chính. Chỉ làm việc với database,
   việc kiểm tra quyền nằm ở controller. */
import { Injectable } from '@nestjs/common';
import {
  maskCccd,
  type FullCccdResponse,
  type Profile,
  type Session,
  type StudentsResponse,
  type UpdateProfileRequest,
} from '@ulaw/shared';
import { PrismaService } from '../common/prisma.service';
import type { User } from '../generated/prisma/client';
import { StudentDirectoryService } from '../student-directory/student-directory.service';

/** Mã lỗi của Prisma khi vi phạm ràng buộc duy nhất (vd CCCD đã thuộc tài khoản khác). */
const PRISMA_UNIQUE_VIOLATION = 'P2002';

@Injectable()
export class ProfileService {
  /**
   * @param prisma            kết nối database
   * @param studentDirectory  thông tin sinh viên từ database trường
   */
  constructor(
    private readonly prisma: PrismaService,
    private readonly studentDirectory: StudentDirectoryService,
  ) {}

  /**
   * Tìm một người dùng theo id.
   * @param userId  id người dùng
   * @returns       người dùng; không có thì null
   */
  findUser(userId: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id: userId } });
  }

  /**
   * Dựng hồ sơ trả về cho giao diện: CCCD đã che.
   * @param user  người dùng
   * @returns     hồ sơ theo ProfileSchema
   */
  toProfile(user: User): Profile {
    return { name: user.name, email: user.email, role: user.role, phone: user.phone, maskedCccd: maskCccd(user.cccd) };
  }

  /**
   * Dựng phản hồi số CCCD đầy đủ.
   * @param user  người dùng
   * @returns     cccd null nếu chưa có
   */
  toFullCccd(user: User): FullCccdResponse {
    return { cccd: user.cccd };
  }

  /**
   * Lấy các MSSV của một người kèm MSSV chính.
   * @param user  người dùng
   * @returns     theo StudentsResponseSchema
   */
  findStudents(user: User): Promise<StudentsResponse> {
    return this.studentDirectory.findStudentsResponse(user.id, user.mainStudentId);
  }

  /**
   * Kiểm tra một MSSV có thuộc người dùng này không.
   * @param userId     id người dùng
   * @param studentId  MSSV cần kiểm tra
   * @returns          true nếu thuộc người này
   */
  async ownsStudent(userId: string, studentId: string): Promise<boolean> {
    const students = await this.studentDirectory.findStudents(userId);
    return students.some((student) => student.studentId === studentId);
  }

  /**
   * Lưu MSSV chính rồi trả thông tin sinh viên mới.
   * @param user       người dùng
   * @param studentId  MSSV đã kiểm tra là thuộc người này
   * @returns          theo StudentsResponseSchema
   */
  async saveMainStudent(user: User, studentId: string): Promise<StudentsResponse> {
    await this.prisma.user.update({ where: { id: user.id }, data: { mainStudentId: studentId } });
    return this.studentDirectory.findStudentsResponse(user.id, studentId);
  }

  /**
   * Kiểm tra số CCCD đã thuộc tài khoản khác chưa.
   * @param cccd    số CCCD
   * @param userId  id người đang lưu (không tính chính mình)
   * @returns       true nếu tài khoản khác đang dùng số này
   */
  async isCccdTaken(cccd: string, userId: string): Promise<boolean> {
    const owner = await this.prisma.user.findUnique({ where: { cccd } });
    return owner !== null && owner.id !== userId;
  }

  /**
   * Lưu họ tên, CCCD, SĐT và đánh dấu đã bổ sung thông tin.
   * @param userId        id người dùng
   * @param profileInput  dữ liệu đã kiểm tra; CCCD, SĐT rỗng nghĩa là không có
   * @returns             phiên mới; null nếu CCCD vừa bị tài khoản khác chiếm (hai người lưu cùng lúc)
   */
  async saveProfile(userId: string, profileInput: UpdateProfileRequest): Promise<Session | null> {
    try {
      const user = await this.prisma.user.update({
        where: { id: userId },
        data: { name: profileInput.name, cccd: profileInput.cccd || null, phone: profileInput.phone || null, completed: true },
      });
      return { user: { id: user.id, email: user.email, name: user.name }, role: user.role, profileCompleted: user.completed };
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === PRISMA_UNIQUE_VIOLATION) return null;
      throw error;
    }
  }
}
