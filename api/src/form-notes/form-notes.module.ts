import { Module } from '@nestjs/common';
import { FormNotesController } from './form-notes.controller';
import { FormNotesService } from './form-notes.service';

@Module({ controllers: [FormNotesController], providers: [FormNotesService] })
export class FormNotesModule {}
