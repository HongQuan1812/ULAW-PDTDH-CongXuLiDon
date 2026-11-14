import { describe, expect, it } from 'vitest';
import type { PrismaService } from '../common/prisma.service';
import type { AppConfig } from '../config/app-config';
import { StudentDirectoryService } from './student-directory.service';

describe('StudentDirectoryService', () => {
  it('bản thật (chưa phát triển): 501', async () => {
    const appConfig = { usesDemoApi: () => false } as unknown as AppConfig;
    const service = new StudentDirectoryService({} as PrismaService, appConfig);
    await expect(service.findStudents('sv-1')).rejects.toMatchObject({ status: 501 });
  });
});
