/* Module gốc: gom cấu hình, database và các nhóm API. */
import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './common/prisma.module';
import { ConfigModule } from './config/config.module';
import { FilesModule } from './files/files.module';
import { FormTypesModule } from './form-types/form-types.module';
import { FormModule } from './form/form.module';
import { FormNotesModule } from './form-notes/form-notes.module';
import { ExportsModule } from './exports/exports.module';
import { FormsModule } from './forms/forms.module';
import { HealthModule } from './health/health.module';
import { ProfileModule } from './profile/profile.module';
import { AccountsModule } from './accounts/accounts.module';
import { EmailModule } from './email/email.module';

@Module({ imports: [ConfigModule, PrismaModule, AuthModule, HealthModule, ProfileModule, AccountsModule, FormTypesModule, FilesModule, FormsModule, FormModule, ExportsModule, FormNotesModule, EmailModule] })
export class AppModule {}
