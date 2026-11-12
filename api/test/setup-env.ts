/* Chạy trước mỗi tệp test: nạp api/.env, như lúc chạy thật. */
import 'reflect-metadata';
import { loadApiEnvFile } from '../src/config/app-config';

loadApiEnvFile();
