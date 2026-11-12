/* Module nhóm API auth. Toàn cục: module khác dùng @RequirePermission mà không phải import lại. */
import { Global, Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';

@Global()
@Module({ controllers: [AuthController], providers: [AuthService, AuthGuard], exports: [AuthService, AuthGuard] })
export class AuthModule {}
