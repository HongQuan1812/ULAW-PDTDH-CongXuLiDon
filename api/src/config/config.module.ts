/* Module cấu hình: cho mọi module khác dùng AppConfig mà không phải import lại. */
import { Global, Module } from '@nestjs/common';
import { AppConfig } from './app-config';

@Global()
@Module({ providers: [AppConfig], exports: [AppConfig] })
export class ConfigModule {}
