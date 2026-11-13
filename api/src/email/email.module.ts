import { Module } from '@nestjs/common';
import { EmailSettingsController } from './email-settings.controller';
import { EmailSettingsService } from './email-settings.service';
import { MailSenderService } from './mail-sender.service';

@Module({ controllers: [EmailSettingsController], providers: [EmailSettingsService, MailSenderService], exports: [MailSenderService] })
export class EmailModule {}
