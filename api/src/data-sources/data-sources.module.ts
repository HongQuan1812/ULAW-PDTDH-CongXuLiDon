import { Module } from '@nestjs/common';
import { StudentDirectoryModule } from '../student-directory/student-directory.module';
import { DataSourcesController } from './data-sources.controller';

@Module({ imports: [StudentDirectoryModule], controllers: [DataSourcesController] })
export class DataSourcesModule {}
