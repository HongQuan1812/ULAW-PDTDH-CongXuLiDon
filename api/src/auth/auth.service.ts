/* Đăng nhập: tạo, tìm, xóa phiên trong database và đổi người dùng thành Session theo hợp đồng. */
import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { DEMO_USER_IDS, type RoleId, type Session } from '@ulaw/shared';
import { isUniqueViolation } from '../common/prisma-errors';
import { PrismaService } from '../common/prisma.service';
import type { User } from '../generated/prisma/client';
import { generateSessionToken, hashSessionToken, sessionExpiry } from './session-cookie';

@Injectable()
export class AuthService {
  /**
   * @param prisma  kết nối database
   */
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Đổi một người dùng trong database thành phiên theo hợp đồng AUTH.
   * @param user  dòng User
   * @returns     người dùng, vai trò, đã xác nhận họ tên lần đầu chưa
   */
  toSession(user: User): Session {
    return { user: { id: user.id, email: user.email, name: user.name }, role: user.role, profileCompleted: user.completed };
  }

  /**
   * Tìm tài khoản theo email Google; chưa có thì tạo mới với vai trò Người nộp đơn, chưa bổ sung thông tin, họ tên trống
   * (giao diện sẽ mở màn Bổ sung thông tin để người dùng tự nhập họ tên).
   * Chỉ gọi sau khi đã kiểm tra email là email trường.
   * @param email  email Google đã xác minh, viết thường
   * @returns      tài khoản đã có, hoặc vừa tạo
   */
  async findOrCreateGoogleUser(email: string): Promise<User> {
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) return existing;

    // Hai lần đăng nhập cùng lúc với cùng email: ràng buộc duy nhất chặn lần sau, lần sau dùng tài khoản lần trước vừa tạo
    try {
      return await this.prisma.user.create({
        data: { id: `tk-${randomUUID()}`, email, role: 'nguoiNopDon', name: '', completed: false },
      });
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      const created = await this.prisma.user.findUnique({ where: { email } });
      if (!created) throw error;
      return created;
    }
  }

  /**
   * Tạo phiên đăng nhập mới cho một người dùng. Nhân tiện xóa mọi phiên đã hết hạn (cookie hết hạn thì trình duyệt không
   * gửi lại nữa, nên không có cách nào khác để những dòng đó bị xóa).
   * @param userId  id người dùng đã được kiểm tra
   * @returns       mã phiên để đặt vào cookie (database chỉ giữ bản băm)
   */
  async createSession(userId: string): Promise<string> {
    const token = generateSessionToken();
    const now = new Date();
    await this.prisma.authSession.deleteMany({ where: { expiresAt: { lte: now } } });
    await this.prisma.authSession.create({
      data: { tokenHash: hashSessionToken(token), userId, createdAt: now, expiresAt: sessionExpiry(now) },
    });
    return token;
  }

  /**
   * Tìm người đang đăng nhập theo mã phiên. Phiên hết hạn thì xóa luôn.
   * Vai trò lấy từ database mỗi lần, nên Admin đổi vai trò là có hiệu lực ngay.
   * @param token  mã phiên trong cookie
   * @returns      người dùng; mã sai, hết hạn hoặc người dùng đã bị xóa thì null
   */
  async findUserBySessionToken(token: string): Promise<User | null> {
    const tokenHash = hashSessionToken(token);
    const session = await this.prisma.authSession.findUnique({ where: { tokenHash }, include: { user: true } });
    if (!session) return null;
    if (session.expiresAt <= new Date()) {
      await this.prisma.authSession.deleteMany({ where: { tokenHash } });
      return null;
    }
    return session.user;
  }

  /**
   * Xóa phiên (đăng xuất). Mã không có trong database thì không làm gì.
   * @param token  mã phiên trong cookie
   */
  async destroySession(token: string): Promise<void> {
    await this.prisma.authSession.deleteMany({ where: { tokenHash: hashSessionToken(token) } });
  }

  /* JUST FOR DEMO: START · chọn tài khoản để đăng nhập thử theo vai trò, bản thật thay bằng Google OAuth */
  /**
   * Chọn tài khoản đăng nhập thử cho một vai trò: tài khoản mẫu của vai trò đó; nếu Admin đã đổi vai trò của nó
   * thì lấy tài khoản đầu tiên (theo ngày tạo) đang có vai trò này.
   * @param role  vai trò muốn thử
   * @returns     người dùng; không còn ai có vai trò này thì null
   */
  async findDemoUser(role: RoleId): Promise<User | null> {
    const demoUser = await this.prisma.user.findUnique({ where: { id: DEMO_USER_IDS[role] } });
    if (demoUser?.role === role) return demoUser;
    return this.prisma.user.findFirst({ where: { role }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
  }
  /* JUST FOR DEMO: END */
}
