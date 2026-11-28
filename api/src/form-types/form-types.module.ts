import { Module } from '@nestjs/common';
import { FormTypeScheduleService } from './form-type-schedule.service';
import { FormTypesController } from './form-types.controller';
import { FormTypesService } from './form-types.service';

@Module({ controllers: [FormTypesController], providers: [FormTypesService, FormTypeScheduleService], exports: [FormTypesService] })
export class FormTypesModule {}
