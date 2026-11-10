import { describe, expect, test } from 'vitest';
import { FORMS_ENDPOINTS, FormCccdsResponseSchema, ManagedFormsResponseSchema } from './forms';

describe('danh sách mọi đơn (Quản lí đơn)', () => {
  const managedForm = {
    code: 'XMM-2026-00001',
    formTypeId: 'xmm',
    formTypeName: 'Xét miễn môn',
    submittedAt: '2026-11-01T08:30',
    status: 'nop',
    receivedAt: null,
    applicant: { id: 'sv-2', name: 'Trần Thị Bảo Ngọc', email: 'baongoc.tran@hcmulaw.edu.vn', phone: null, maskedCccd: null },
  };

  test('đường dẫn: GET /forms lấy mọi đơn, GET /forms/cccds lấy CCCD đầy đủ', () => {
    expect(FORMS_ENDPOINTS.list).toBe('/forms');
    expect(FORMS_ENDPOINTS.cccds).toBe('/forms/cccds');
  });

  test('chấp nhận đơn có người nộp chưa có SĐT, CCCD và đơn chưa tiếp nhận', () => {
    expect(ManagedFormsResponseSchema.safeParse({ forms: [managedForm] }).success).toBe(true);
  });

  test('từ chối đơn thiếu thông tin người nộp', () => {
    const { applicant: _applicant, ...withoutApplicant } = managedForm;
    expect(ManagedFormsResponseSchema.safeParse({ forms: [withoutApplicant] }).success).toBe(false);
  });

  test('CCCD đầy đủ trả theo id người nộp', () => {
    expect(FormCccdsResponseSchema.safeParse({ cccds: { 'cb-1': '079300000001' } }).success).toBe(true);
    expect(FormCccdsResponseSchema.safeParse({ cccds: [] }).success).toBe(false);
  });
});
