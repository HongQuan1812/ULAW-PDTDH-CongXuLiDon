/* Kiểm tra dữ liệu request (body, tham số) bằng schema Zod trong shared/, giống API giả. */
import type { PipeTransform } from '@nestjs/common';
import type { z } from 'zod';
import { ApiException } from './api-exception';

export class ZodValidationPipe<Schema extends z.ZodType> implements PipeTransform<unknown, z.output<Schema>> {
  /**
   * @param schema          schema của dữ liệu, vd UpdateProfileRequestSchema
   * @param invalidMessage  câu báo khi sai mà schema không có câu riêng, vd PROFILE_MESSAGES[422]
   */
  constructor(
    private readonly schema: Schema,
    private readonly invalidMessage: string,
  ) {}

  /**
   * Kiểm tra dữ liệu gửi lên.
   * @param requestInput  dữ liệu thô của request
   * @returns             dữ liệu đã kiểm tra (đã bỏ trường thừa, đã đổi kiểu theo schema)
   * @throws              ApiException 422, câu báo lỗi của ô đầu tiên bị sai
   */
  transform(requestInput: unknown): z.output<Schema> {
    const parsed = this.schema.safeParse(requestInput);
    if (!parsed.success) throw new ApiException(422, parsed.error.issues[0]?.message ?? this.invalidMessage);
    return parsed.data;
  }
}
