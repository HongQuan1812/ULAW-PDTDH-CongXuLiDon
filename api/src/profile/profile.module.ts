import { Module } from '@nestjs/common';
import { FormsModule } from '../forms/forms.module';
import { StudentDirectoryModule } from '../student-directory/student-directory.module';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';

@Module({ imports: [StudentDirectoryModule, FormsModule], controllers: [ProfileController], providers: [ProfileService] })
export class ProfileModule {}
