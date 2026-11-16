import { Module } from '@nestjs/common';
import { BackupsController } from './backups.controller';
import { BackupsService } from './backups.service';
import { GoogleDriveBackupService } from './google-drive-backup.service';

@Module({ controllers: [BackupsController], providers: [BackupsService, GoogleDriveBackupService] })
export class BackupsModule {}
