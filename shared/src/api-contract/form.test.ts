import { describe, expect, test } from 'vitest';
import {
  DecideFormRequestSchema,
  FORM_DECISIONS,
  SubmitFormRequestSchema,
  TransferFormRequestSchema,
  UpdateFormRequestSchema,
  formDecisionPath,
  formTransferPath,
  formTransferTargetsPath,
} from './form';

describe('TransferFormRequestSchema', () => {
  test('chấp nhận id cán bộ nhận đơn', () => {
    expect(TransferFormRequestSchema.safeParse({ toStaffId: 'cb-2' }).success).toBe(true);
  });

  test('từ chối khi thiếu hoặc rỗng id cán bộ nhận', () => {
    expect(TransferFormRequestSchema.safeParse({}).success).toBe(false);
    expect(TransferFormRequestSchema.safeParse({ toStaffId: '' }).success).toBe(false);
  });
});

describe('đường dẫn chuyển giao', () => {
  test('ghép mã đơn vào đường dẫn Chuyển giao và danh sách cán bộ nhận', () => {
    expect(formTransferPath('XMM-2026-001-00001')).toBe('/forms/XMM-2026-001-00001/transfer');
    expect(formTransferTargetsPath('XMM-2026-001-00001')).toBe('/forms/XMM-2026-001-00001/transfer-targets');
  });
});

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
    expect(formDecisionPath('XMM-2026-001-00001')).toBe('/forms/XMM-2026-001-00001/decision');
  });
});

describe('SubmitFormRequestSchema: nộp thay', () => {
  const ownForm = { formTypeId: 'xmm', answers: {}, committed: true };

  test('không có applicantId là đơn của chính mình', () => {
    expect(SubmitFormRequestSchema.parse(ownForm).applicantId).toBeUndefined();
  });

  test('có applicantId là nộp thay cho người đó; chuỗi rỗng thì sai', () => {
    expect(SubmitFormRequestSchema.parse({ ...ownForm, applicantId: 'sv-5' }).applicantId).toBe('sv-5');
    expect(SubmitFormRequestSchema.safeParse({ ...ownForm, applicantId: '' }).success).toBe(false);
  });

  test('sửa đơn không đổi được người nộp đơn (bỏ applicantId)', () => {
    expect(UpdateFormRequestSchema.parse({ answers: {}, committed: true, applicantId: 'sv-5' })).not.toHaveProperty('applicantId');
  });
});
