import { Module } from '@nestjs/common';
import { StudentDirectoryService } from './student-directory.service';

@Module({ providers: [StudentDirectoryService], exports: [StudentDirectoryService] })
export class StudentDirectoryModule {}
