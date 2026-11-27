import { Module } from '@nestjs/common';
import { HolidaysModule } from '../holidays/holidays.module';
import { EmailSettingsController } from './email-settings.controller';
import { EmailSettingsService } from './email-settings.service';
import { FormEmailService } from './form-email.service';
import { MailSenderService } from './mail-sender.service';

@Module({
  imports: [HolidaysModule],
  controllers: [EmailSettingsController], providers: [EmailSettingsService, MailSenderService, FormEmailService],
  exports: [FormEmailService],
})
export class EmailModule {}
