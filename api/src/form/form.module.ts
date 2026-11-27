import { Module } from '@nestjs/common';
import { EmailModule } from '../email/email.module';
import { FilesModule } from '../files/files.module';
import { FormTypesModule } from '../form-types/form-types.module';
import { HolidaysModule } from '../holidays/holidays.module';
import { FormController } from './form.controller';
import { FormService } from './form.service';
import { WorkflowService } from './workflow.service';

@Module({ imports: [FilesModule, FormTypesModule, EmailModule, HolidaysModule], controllers: [FormController], providers: [FormService, WorkflowService], exports: [FormService] })
export class FormModule {}
