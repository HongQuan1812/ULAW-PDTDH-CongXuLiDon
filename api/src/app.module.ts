/* Module gốc: gom cấu hình, database và các nhóm API. */
import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './common/prisma.module';
import { ConfigModule } from './config/config.module';
import { FilesModule } from './files/files.module';
import { FormTypesModule } from './form-types/form-types.module';
import { HealthModule } from './health/health.module';
import { ProfileModule } from './profile/profile.module';
import { AccountsModule } from './accounts/accounts.module';

@Module({ imports: [ConfigModule, PrismaModule, AuthModule, HealthModule, ProfileModule, AccountsModule, FormTypesModule, FilesModule] })
export class AppModule {}
