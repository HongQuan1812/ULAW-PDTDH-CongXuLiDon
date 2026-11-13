import { describe, expect, test } from 'vitest';
import { formTypeStatusOf } from './form-types--stats';

describe('trạng thái của loại đơn (cho biểu đồ thống kê)', () => {
  test('có một phiên bản đang mở thì cả loại đơn là Đang mở, dù phiên bản mới nhất đã đóng hay còn nháp', () => {
    expect(formTypeStatusOf(['closed', 'open', 'closed'])).toBe('open');
    expect(formTypeStatusOf(['open', 'draft'])).toBe('open');
  });

  test('không phiên bản nào đang mở thì lấy trạng thái phiên bản mới nhất (cuối danh sách)', () => {
    expect(formTypeStatusOf(['closed', 'draft'])).toBe('draft');
    expect(formTypeStatusOf(['draft', 'closed'])).toBe('closed');
    expect(formTypeStatusOf(['closed'])).toBe('closed');
  });
});
