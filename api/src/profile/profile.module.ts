import { Module } from '@nestjs/common';
import { StudentDirectoryModule } from '../student-directory/student-directory.module';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';

@Module({ imports: [StudentDirectoryModule], controllers: [ProfileController], providers: [ProfileService] })
export class ProfileModule {}
