import { Module } from '@nestjs/common';
import { HolidaysModule } from '../holidays/holidays.module';
import { FormsController } from './forms.controller';
import { FormsService } from './forms.service';

@Module({ imports: [HolidaysModule], controllers: [FormsController], providers: [FormsService], exports: [FormsService] })
export class FormsModule {}
