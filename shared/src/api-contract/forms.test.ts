import { describe, expect, test } from 'vitest';
import { DecideFormRequestSchema, FORM_DECISIONS, formDecisionPath } from './forms';

describe('DecideFormRequestSchema', () => {
  test('chấp nhận ba quyết định: yêu cầu bổ sung, duyệt, từ chối', () => {
    expect(FORM_DECISIONS).toEqual(['bs', 'duyet', 'tc']);
    for (const decision of FORM_DECISIONS) {
      expect(DecideFormRequestSchema.safeParse({ decision, note: '' }).success).toBe(true);
    }
  });

  test('từ chối quyết định không có trong danh sách (vd trạng thái Đang xét)', () => {
    expect(DecideFormRequestSchema.safeParse({ decision: 'xet', note: '' }).success).toBe(false);
  });

  test('cắt khoảng trắng đầu và cuối của lí do', () => {
    const decideRequest = DecideFormRequestSchema.parse({ decision: 'bs', note: '  Thiếu bảng điểm  ' });
    expect(decideRequest.note).toBe('Thiếu bảng điểm');
  });

  test('báo lỗi khi thiếu lí do (không có lí do thì gửi chuỗi rỗng)', () => {
    expect(DecideFormRequestSchema.safeParse({ decision: 'tc' }).success).toBe(false);
  });
});

describe('formDecisionPath', () => {
  test('ghép mã đơn vào đường dẫn Ra quyết định', () => {
    expect(formDecisionPath('XMM-2026-00001')).toBe('/forms/XMM-2026-00001/decision');
  });
});
