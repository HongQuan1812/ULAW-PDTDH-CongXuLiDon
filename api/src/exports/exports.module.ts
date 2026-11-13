import { Module } from '@nestjs/common';
import { FormModule } from '../form/form.module';
import { StudentDirectoryModule } from '../student-directory/student-directory.module';
import { ExportsController } from './exports.controller';
import { ExportsService } from './exports.service';

@Module({ imports: [FormModule, StudentDirectoryModule], controllers: [ExportsController], providers: [ExportsService] })
export class ExportsModule {}
