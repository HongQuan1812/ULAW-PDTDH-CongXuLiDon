import { Module } from '@nestjs/common';
import { SchoolDatabaseService } from './school-database.service';
import { StudentDirectoryService } from './student-directory.service';

@Module({ providers: [StudentDirectoryService, SchoolDatabaseService], exports: [StudentDirectoryService, SchoolDatabaseService] })
export class StudentDirectoryModule {}
