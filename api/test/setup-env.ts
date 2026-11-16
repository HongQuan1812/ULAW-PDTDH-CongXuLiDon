/* Chạy trước mỗi tệp test: nạp .env.dev, như lúc chạy thật.
   Riêng máy chủ thư luôn bỏ trống: test không bao giờ gửi thư thật (thư chỉ dựng rồi in ra, nhờ bản giả dev-email). */
import 'reflect-metadata';
import { loadDevEnvFile } from '../src/config/env-file';

loadDevEnvFile();
process.env['SMTP_HOST'] = '';
// Mặc định dùng bản giả (đăng nhập thử), không phụ thuộc .env.dev của máy đang chạy; test đăng nhập Google tự tắt
process.env['ENABLE_DEMO_APIS'] = 'true';
process.env['ALWAYS_REAL_APIS'] = '';
process.env['DEV_EMAIL_REDIRECT_TO'] = '';
