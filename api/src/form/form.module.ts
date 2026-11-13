import { Module } from '@nestjs/common';
import { FilesModule } from '../files/files.module';
import { FormTypesModule } from '../form-types/form-types.module';
import { FormController } from './form.controller';
import { FormService } from './form.service';
import { WorkflowService } from './workflow.service';

@Module({ imports: [FilesModule, FormTypesModule], controllers: [FormController], providers: [FormService, WorkflowService], exports: [FormService] })
export class FormModule {}
