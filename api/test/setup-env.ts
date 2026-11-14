/* Chạy trước mỗi tệp test: nạp api/.env, như lúc chạy thật.
   Riêng máy chủ thư luôn bỏ trống: test không bao giờ gửi thư thật (thư chỉ dựng rồi in ra, nhờ APP_ENV=dev). */
import 'reflect-metadata';
import { loadApiEnvFile } from '../src/config/app-config';

loadApiEnvFile();
process.env['SMTP_HOST'] = '';
// Mặc định dùng bản giả (đăng nhập thử), không phụ thuộc api/.env của máy đang chạy; test đăng nhập Google tự tắt
process.env['ENABLE_DEMO_APIS'] = 'true';
process.env['ALWAYS_REAL_APIS'] = '';
process.env['DEV_EMAIL_REDIRECT_TO'] = '';
