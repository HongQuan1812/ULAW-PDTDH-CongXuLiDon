/* Test kết nối database trường. Phần kết nối thật chỉ chạy khi có SCHOOL_DB_HOST (máy trong LAN trường);
   CI không tới được database trường thì bỏ qua. */
import { afterAll, describe, expect, it } from 'vitest';
import { STUDENTS_MESSAGES } from '@ulaw/shared';
import { AppConfig, type SchoolDatabaseConfig } from '../config/app-config';
import { SchoolDatabaseService } from './school-database.service';

/**
 * Dựng service với cấu hình database trường cho trước.
 * @param schoolDatabase  địa chỉ, tài khoản; null = chưa cấu hình
 * @returns               service
 */
function serviceWith(schoolDatabase: SchoolDatabaseConfig | null): SchoolDatabaseService {
  return new SchoolDatabaseService({ schoolDatabase } as AppConfig);
}

describe('SchoolDatabaseService', () => {
  it('chưa cấu hình SCHOOL_DB_HOST: 503', async () => {
    await expect(serviceWith(null).findStudentsByEmail('ai.do@email.hcmulaw.edu.vn')).rejects.toMatchObject({
      status: 503,
      message: STUDENTS_MESSAGES[503],
    });
  });

  it('không tới được database trường: 503, lần sau vẫn thử kết nối lại', async () => {
    const service = serviceWith({ host: '127.0.0.1', port: 1, user: 'khong-co', password: 'khong-co' });

    await expect(service.findStudentsByEmail('ai.do@email.hcmulaw.edu.vn')).rejects.toMatchObject({ status: 503 });
    await expect(service.findStudentsByEmail('ai.do@email.hcmulaw.edu.vn')).rejects.toMatchObject({ status: 503 });
  });
});

describe.runIf(process.env['SCHOOL_DB_HOST'])('SchoolDatabaseService, kết nối thật', () => {
  const service = new SchoolDatabaseService(new AppConfig());
  afterAll(() => service.onModuleDestroy());

  it('email không có trong database trường: []', async () => {
    expect(await service.findStudentsByEmail('khong.co.ai@email.hcmulaw.edu.vn')).toEqual([]);
  });
});
