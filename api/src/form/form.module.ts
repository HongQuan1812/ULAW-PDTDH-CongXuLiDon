import { Module } from '@nestjs/common';
import { FilesModule } from '../files/files.module';
import { FormTypesModule } from '../form-types/form-types.module';
import { FormController } from './form.controller';
import { FormService } from './form.service';

@Module({ imports: [FilesModule, FormTypesModule], controllers: [FormController], providers: [FormService] })
export class FormModule {}
