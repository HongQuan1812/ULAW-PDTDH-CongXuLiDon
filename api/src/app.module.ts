/* Module gốc: gom cấu hình, database và các nhóm API. */
import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './common/prisma.module';
import { ConfigModule } from './config/config.module';
import { HealthModule } from './health/health.module';

@Module({ imports: [ConfigModule, PrismaModule, AuthModule, HealthModule] })
export class AppModule {}
