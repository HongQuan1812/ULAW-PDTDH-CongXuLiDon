/* Test pipe kiểm tra request bằng schema Zod. */
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ApiException } from './api-exception';
import { ZodValidationPipe } from './zod-validation.pipe';

const NameSchema = z.object({ name: z.string().min(1, 'Hãy nhập họ tên.') });

describe('ZodValidationPipe', () => {
  const pipe = new ZodValidationPipe(NameSchema, 'Dữ liệu không hợp lệ.');

  it('trả dữ liệu đã kiểm tra, bỏ trường thừa', () => {
    expect(pipe.transform({ name: 'An', extra: 1 })).toEqual({ name: 'An' });
  });

  it('sai thì ném 422 kèm câu báo của ô đầu tiên bị sai', () => {
    try {
      pipe.transform({ name: '' });
      throw new Error('phải ném lỗi');
    } catch (error) {
      expect(error).toBeInstanceOf(ApiException);
      expect((error as ApiException).getStatus()).toBe(422);
      expect((error as ApiException).message).toBe('Hãy nhập họ tên.');
    }
  });
});
