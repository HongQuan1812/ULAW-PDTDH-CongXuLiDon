import { describe, expect, test } from 'vitest';
import { FILE_ENDPOINTS, FILE_MESSAGES, fileContentPath } from './files';

describe('đường dẫn tệp', () => {
  test('GET /files/:fileId lấy nội dung một tệp', () => {
    expect(FILE_ENDPOINTS.content).toBe('/files/:fileId');
  });

  test('ghép id tệp vào đường dẫn, mã hóa ký tự đặc biệt', () => {
    expect(fileContentPath('file-123')).toBe('/files/file-123');
    expect(fileContentPath('a/b')).toBe('/files/a%2Fb');
  });
});

describe('câu thông báo tệp', () => {
  test('không có tệp hoặc không được xem thì dùng một câu, không lộ tệp của người khác', () => {
    expect(FILE_MESSAGES.notFound).toMatch(/không có tệp/i);
  });
});
