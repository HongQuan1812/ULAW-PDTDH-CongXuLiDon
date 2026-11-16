/* Kết nối tới database trường (SQL Server), chỉ đọc. Một pool dùng chung, kết nối lần đầu khi cần, đóng khi tắt backend.
   Database trường chưa cấu hình, không tới được hoặc lỗi: trả 503, các trang khác vẫn chạy. */
import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { STUDENTS_MESSAGES, type StudentInfo } from '@ulaw/shared';
import sql from 'mssql';
import { ApiException } from '../common/api-exception';
import { AppConfig } from '../config/app-config';
import { buildStudentsByEmailQuery, EMAIL_PARAMETER, SCHOOL_DATABASE_NAME, toStudentInfos, type SchoolStudentRow } from './school-students-query';

/** Chờ kết nối / chờ trả kết quả tối đa bao lâu, để trang không treo khi database trường chậm. */
const CONNECTION_TIMEOUT_MS = 5000;
const REQUEST_TIMEOUT_MS = 10000;

/** Câu SELECT dựng một lần, chỉ phụ thuộc school-database.json. */
const STUDENTS_BY_EMAIL_QUERY = buildStudentsByEmailQuery();

@Injectable()
export class SchoolDatabaseService implements OnModuleDestroy {
  private readonly logger = new Logger(SchoolDatabaseService.name);
  /** Pool đang kết nối hoặc đã kết nối; null khi chưa kết nối hoặc lần trước lỗi (lần sau kết nối lại). */
  private connectingPool: Promise<sql.ConnectionPool> | null = null;

  /** @param appConfig  cấu hình, lấy địa chỉ và tài khoản database trường */
  constructor(private readonly appConfig: AppConfig) {}

  /**
   * Tìm các MSSV có email trường này.
   * @param email  email đăng nhập, vd '2253801011001@email.hcmulaw.edu.vn'
   * @returns      các MSSV, MSSV trùng phần trước @ đứng đầu; email không có trong database trường thì []
   * @throws       503 chưa cấu hình SCHOOL_DB_HOST, hoặc database trường không tới được / lỗi
   */
  async findStudentsByEmail(email: string): Promise<StudentInfo[]> {
    // Email là tham số (không nối vào câu SQL); kiểu VarChar cho khớp kiểu cột, SQL Server khỏi đổi kiểu từng dòng
    try {
      const pool = await this.pool();
      const queryResult = await pool.request().input(EMAIL_PARAMETER, sql.VarChar(sql.MAX), email).query<SchoolStudentRow>(STUDENTS_BY_EMAIL_QUERY);
      return toStudentInfos(queryResult.recordset, email);
    } catch (error) {
      if (error instanceof ApiException) throw error;
      this.logger.error(`Không đọc được database trường: ${error instanceof Error ? error.message : String(error)}`);
      throw new ApiException(503, STUDENTS_MESSAGES[503]);
    }
  }

  /**
   * Lấy pool dùng chung, kết nối lần đầu khi cần. Kết nối lỗi thì bỏ pool đó, lần gọi sau thử lại.
   * @returns  pool đã kết nối
   * @throws   503 chưa cấu hình SCHOOL_DB_HOST · lỗi của mssql khi không kết nối được
   */
  private pool(): Promise<sql.ConnectionPool> {
    // Chưa cấu hình: ghi rõ vào log cho người quản trị, người dùng chỉ thấy câu thông báo chung
    const config = this.appConfig.schoolDatabase;
    if (!config) {
      this.logger.error('Chưa cấu hình database trường (SCHOOL_DB_HOST trống trong .env.dev / .env.prod).');
      throw new ApiException(503, STUDENTS_MESSAGES[503]);
    }

    // Kết nối một lần, các request sau dùng lại; lỗi thì xóa để lần sau kết nối lại
    this.connectingPool ??= new sql.ConnectionPool({
      server: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      database: SCHOOL_DATABASE_NAME,
      connectionTimeout: CONNECTION_TIMEOUT_MS,
      requestTimeout: REQUEST_TIMEOUT_MS,
      pool: { max: 5, min: 0, idleTimeoutMillis: 60000 },
      // Mã hóa đường truyền; máy chủ trường dùng chứng chỉ tự kí trong LAN nên tin chứng chỉ của máy chủ
      options: { encrypt: true, trustServerCertificate: true },
    })
      .connect()
      .catch((error: unknown) => {
        this.connectingPool = null;
        throw error;
      });
    return this.connectingPool;
  }

  /** Đóng kết nối khi backend tắt. */
  async onModuleDestroy(): Promise<void> {
    const pool = await this.connectingPool?.catch(() => null);
    await pool?.close();
  }
}
