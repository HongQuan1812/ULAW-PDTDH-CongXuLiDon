/* Nhóm API health: máy chủ có đang trả lời không, có nối được database không. */
import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { HEALTH_ENDPOINTS, HealthResponseSchema, type HealthResponse } from '@ulaw/shared';
import { PrismaService } from '../common/prisma.service';
import { openApiSchemaOf } from '../common/swagger';

@ApiTags('health')
@Controller()
export class HealthController {
  /**
   * @param prisma  kết nối database
   */
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Kiểm tra máy chủ và database.
   * @returns  { ok: true }; database không trả lời thì 500 (lọc lỗi trả câu chung)
   */
  @Get(HEALTH_ENDPOINTS.check)
  @ApiOkResponse({ schema: openApiSchemaOf(HealthResponseSchema) })
  async check(): Promise<HealthResponse> {
    await this.prisma.$queryRaw`SELECT 1`;
    return { ok: true };
  }
}
