/* Quản lí tài khoản: danh sách phân trang, CCCD đầy đủ, tạo, sửa. Chỉ làm việc với database,
   việc kiểm tra quyền nằm ở controller. */
import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import {
  ACCOUNT_LIST_DEFAULT_SORTING,
  ACCOUNT_LIST_FIELDS,
  ACCOUNT_MESSAGES,
  applyListQuery,
  maskCccd,
  type Account,
  type AccountCccdsResponse,
  type AccountsResponse,
  type CreateAccountRequest,
  type ListQuery,
  type UpdateAccountRequest,
} from '@ulaw/shared';
import { ApiException } from '../common/api-exception';
import { isUniqueViolation } from '../common/prisma-errors';
import { PrismaService } from '../common/prisma.service';
import type { User } from '../generated/prisma/client';

@Injectable()
export class AccountsService {
  /** @param prisma  kết nối database */
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Dựng một dòng của bảng tài khoản: CCCD đã che.
   * @param user  người dùng trong database
   * @returns     tài khoản theo AccountSchema
   */
  private toAccount(user: User): Account {
    return { id: user.id, name: user.name, email: user.email, role: user.role, phone: user.phone, maskedCccd: maskCccd(user.cccd) };
  }

  /**
   * Lấy một trang tài khoản. Tìm được theo số CCCD đầy đủ dù bảng chỉ hiện CCCD che.
   * @param listQuery  trang, số dòng, chữ tìm, sắp xếp, lọc
   * @returns          theo AccountsResponseSchema
   */
  async findPage(listQuery: ListQuery): Promise<AccountsResponse> {
    const users = await this.prisma.user.findMany();
    const fullCccdByAccount = new Map(users.map((user) => [user.id, user.cccd ?? '']));
    const { rows, ...pageMeta } = applyListQuery(
      users.map((user) => this.toAccount(user)),
      ACCOUNT_LIST_FIELDS,
      listQuery,
      ACCOUNT_LIST_DEFAULT_SORTING,
      (account) => [fullCccdByAccount.get(account.id) ?? ''],
    );
    return { accounts: rows, ...pageMeta };
  }

  /**
   * Lấy CCCD đầy đủ của các tài khoản đang có trên trang bảng.
   * @param userIds  id các tài khoản được hỏi
   * @returns        CCCD theo id; tài khoản chưa có CCCD thì không có mặt
   */
  async findCccds(userIds: readonly string[]): Promise<AccountCccdsResponse> {
    const users = await this.prisma.user.findMany({ where: { id: { in: [...userIds] }, cccd: { not: null } } });
    return { cccds: Object.fromEntries(users.map((user) => [user.id, user.cccd!])) };
  }

  /**
   * Tạo tài khoản mới (chưa bổ sung thông tin: người dùng tự điền khi đăng nhập lần đầu).
   * @param accountInput  dữ liệu đã kiểm tra (email chữ thường); cccd, phone rỗng = không có
   * @returns             tài khoản vừa tạo
   * @throws              409 email hoặc CCCD đã có tài khoản
   */
  async create(accountInput: CreateAccountRequest): Promise<Account> {
    // Báo lỗi rõ ràng trước khi ghi
    if (await this.prisma.user.findUnique({ where: { email: accountInput.email } })) {
      throw new ApiException(409, ACCOUNT_MESSAGES.emailTaken);
    }
    if (accountInput.cccd && (await this.prisma.user.findUnique({ where: { cccd: accountInput.cccd } }))) {
      throw new ApiException(409, ACCOUNT_MESSAGES.cccdTaken);
    }

    // Ghi; hai người tạo cùng lúc thì ràng buộc duy nhất của database chặn người đến sau
    try {
      const user = await this.prisma.user.create({
        data: {
          id: `tk-${randomUUID()}`,
          email: accountInput.email,
          role: accountInput.role,
          name: accountInput.name,
          phone: accountInput.phone || null,
          cccd: accountInput.cccd || null,
          completed: false,
        },
      });
      return this.toAccount(user);
    } catch (error) {
      if (isUniqueViolation(error)) {
        const emailTaken = (await this.prisma.user.findUnique({ where: { email: accountInput.email } })) !== null;
        throw new ApiException(409, emailTaken ? ACCOUNT_MESSAGES.emailTaken : ACCOUNT_MESSAGES.cccdTaken);
      }
      throw error;
    }
  }

  /**
   * Sửa họ tên, CCCD, SĐT, vai trò của một tài khoản. Email giữ nguyên.
   * @param userId        id tài khoản cần sửa
   * @param accountInput  dữ liệu đã kiểm tra
   * @param editor        người đang sửa: không được đổi vai trò của chính mình
   * @returns             tài khoản sau khi sửa
   * @throws              404 không có tài khoản · 422 tự đổi vai trò · 409 CCCD đã thuộc tài khoản khác
   */
  async update(userId: string, accountInput: UpdateAccountRequest, editor: User): Promise<Account> {
    // Kiểm tra theo thứ tự: có tài khoản, không tự đổi vai trò, CCCD không trùng
    const current = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!current) throw new ApiException(404, ACCOUNT_MESSAGES[404]);
    if (userId === editor.id && accountInput.role !== current.role) throw new ApiException(422, ACCOUNT_MESSAGES.ownRole);
    if (accountInput.cccd) {
      const owner = await this.prisma.user.findUnique({ where: { cccd: accountInput.cccd } });
      if (owner && owner.id !== userId) throw new ApiException(409, ACCOUNT_MESSAGES.cccdTaken);
    }

    // Ghi; CCCD vừa bị người khác chiếm thì database chặn
    try {
      const user = await this.prisma.user.update({
        where: { id: userId },
        data: { name: accountInput.name, cccd: accountInput.cccd || null, phone: accountInput.phone || null, role: accountInput.role },
      });
      return this.toAccount(user);
    } catch (error) {
      if (isUniqueViolation(error)) throw new ApiException(409, ACCOUNT_MESSAGES.cccdTaken);
      throw error;
    }
  }

  /**
   * Tìm tài khoản theo id (để controller biết vai trò hiện tại trước khi sửa).
   * @param userId  id tài khoản
   * @returns       người dùng; không có thì null
   */
  findUser(userId: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id: userId } });
  }
}
